#!/usr/bin/env python3
"""
Migration Rollback Script for AiLert Platform
Provides safe rollback procedures for data migration from DynamoDB to PostgreSQL

This script handles:
1. Rollback of specific migrations
2. Data restoration from backup tables
3. Validation of rollback operations
4. Cleanup of rollback artifacts
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("rollback.log"), logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


class RollbackError(Exception):
    """Custom exception for rollback errors"""

    pass


class MigrationRollback:
    """Handles migration rollback operations"""

    def __init__(self, pg_config: Dict[str, str]):
        self.pg_config = pg_config
        self.pg_conn = None

    def connect_postgresql(self) -> None:
        """Establish PostgreSQL connection"""
        try:
            self.pg_conn = psycopg2.connect(**self.pg_config)
            self.pg_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            logger.info("Connected to PostgreSQL successfully")
        except psycopg2.Error as e:
            raise RollbackError(f"Failed to connect to PostgreSQL: {e}")

    def list_available_rollbacks(self) -> List[Dict[str, Any]]:
        """List all available rollback operations"""
        if not self.pg_conn:
            self.connect_postgresql()

        try:
            with self.pg_conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cursor:
                cursor.execute(
                    """
                    SELECT
                        ms.migration_name,
                        ms.status,
                        ms.completed_at,
                        ms.records_processed,
                        ms.records_total,
                        CASE
                            WHEN EXISTS (
                                SELECT 1 FROM migration_rollback mr
                                WHERE mr.migration_name = ms.migration_name
                                AND mr.rollback_status = 'completed'
                            ) THEN 'available'
                            ELSE 'not_available'
                        END as rollback_status
                    FROM migration_status ms
                    WHERE ms.status = 'completed'
                    ORDER BY ms.completed_at DESC
                """
                )

                return [dict(row) for row in cursor.fetchall()]

        except psycopg2.Error as e:
            logger.error(f"Failed to list available rollbacks: {e}")
            raise RollbackError(f"Failed to list rollbacks: {e}")

    def get_migration_details(self, migration_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific migration"""
        if not self.pg_conn:
            self.connect_postgresql()

        try:
            with self.pg_conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cursor:
                cursor.execute(
                    """
                    SELECT
                        ms.*,
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'backup_location', mr.backup_location,
                                    'rollback_status', mr.rollback_status,
                                    'started_at', mr.started_at,
                                    'completed_at', mr.completed_at
                                )
                            )
                            FROM migration_rollback mr
                            WHERE mr.migration_name = ms.migration_name
                        ) as rollback_history
                    FROM migration_status ms
                    WHERE ms.migration_name = %s
                """,
                    (migration_name,),
                )

                result = cursor.fetchone()
                return dict(result) if result else None

        except psycopg2.Error as e:
            logger.error(f"Failed to get migration details: {e}")
            return None

    def validate_rollback_prerequisites(self, migration_name: str) -> bool:
        """Validate that rollback can be performed safely"""
        if not self.pg_conn:
            self.connect_postgresql()

        try:
            with self.pg_conn.cursor() as cursor:
                # Check if migration exists and is completed
                cursor.execute(
                    """
                    SELECT status FROM migration_status
                    WHERE migration_name = %s
                """,
                    (migration_name,),
                )

                result = cursor.fetchone()
                if not result:
                    logger.error(f"Migration {migration_name} not found")
                    return False

                if result[0] != "completed":
                    logger.error(
                        f"Migration {migration_name} is not completed (status: {result[0]})"
                    )
                    return False

                # Check if backup exists
                cursor.execute(
                    """
                    SELECT backup_location FROM migration_rollback
                    WHERE migration_name = %s
                    AND rollback_status = 'completed'
                    ORDER BY started_at DESC LIMIT 1
                """,
                    (migration_name,),
                )

                backup_result = cursor.fetchone()
                if not backup_result:
                    logger.error(f"No backup found for migration {migration_name}")
                    return False

                backup_table = backup_result[0]

                # Verify backup table exists
                cursor.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_name = %s
                    )
                """,
                    (backup_table,),
                )

                if not cursor.fetchone()[0]:
                    logger.error(f"Backup table {backup_table} does not exist")
                    return False

                logger.info(f"Rollback prerequisites validated for {migration_name}")
                return True

        except psycopg2.Error as e:
            logger.error(f"Failed to validate rollback prerequisites: {e}")
            return False

    def perform_rollback(self, migration_name: str, confirm: bool = False) -> bool:
        """Perform rollback operation for a specific migration"""
        if not confirm:
            logger.error("Rollback must be explicitly confirmed with --confirm flag")
            return False

        if not self.validate_rollback_prerequisites(migration_name):
            return False

        logger.info(f"Starting rollback for migration: {migration_name}")

        try:
            with self.pg_conn.cursor() as cursor:
                # Get backup table name
                cursor.execute(
                    """
                    SELECT backup_location FROM migration_rollback
                    WHERE migration_name = %s
                    AND rollback_status = 'completed'
                    ORDER BY started_at DESC LIMIT 1
                """,
                    (migration_name,),
                )

                backup_table = cursor.fetchone()[0]

                # Determine target table based on migration name
                target_table_map = {
                    "csv_subscribers_migration": "contacts",
                    "dynamodb_newsletters_migration": "newsletters",
                    "dynamodb_content_migration": "content_items",
                    "engagement_data_migration": "engagement_events",
                }

                target_table = target_table_map.get(migration_name)
                if not target_table:
                    raise RollbackError(f"Unknown migration name: {migration_name}")

                # Start rollback tracking
                cursor.execute(
                    """
                    INSERT INTO migration_rollback (
                        migration_name, backup_location, rollback_status, rollback_reason
                    ) VALUES (%s, %s, 'in_progress', 'Manual rollback requested')
                    RETURNING id
                """,
                    (migration_name, backup_table),
                )

                rollback_id = cursor.fetchone()[0]

                # Get record counts before rollback
                cursor.execute(f"SELECT COUNT(*) FROM {target_table}")
                before_count = cursor.fetchone()[0]

                cursor.execute(f"SELECT COUNT(*) FROM {backup_table}")
                backup_count = cursor.fetchone()[0]

                logger.info(f"Target table {target_table} has {before_count} records")
                logger.info(f"Backup table {backup_table} has {backup_count} records")

                # Perform rollback using the database function
                cursor.execute(
                    """
                    SELECT rollback_migration(%s, %s, %s)
                """,
                    (migration_name, backup_table, target_table),
                )

                rollback_success = cursor.fetchone()[0]

                if rollback_success:
                    # Verify rollback
                    cursor.execute(f"SELECT COUNT(*) FROM {target_table}")
                    after_count = cursor.fetchone()[0]

                    # Update rollback status
                    cursor.execute(
                        """
                        UPDATE migration_rollback
                        SET rollback_status = 'completed', completed_at = NOW()
                        WHERE id = %s
                    """,
                        (rollback_id,),
                    )

                    # Update migration status
                    cursor.execute(
                        """
                        UPDATE migration_status
                        SET status = 'rolled_back', updated_at = NOW()
                        WHERE migration_name = %s
                    """,
                        (migration_name,),
                    )

                    logger.info(f"Rollback completed successfully")
                    logger.info(f"Records after rollback: {after_count}")
                    logger.info(f"Expected records: {backup_count}")

                    if after_count == backup_count:
                        logger.info("Rollback validation passed")
                        return True
                    else:
                        logger.warning(f"Record count mismatch after rollback")
                        return False
                else:
                    # Update rollback status on failure
                    cursor.execute(
                        """
                        UPDATE migration_rollback
                        SET rollback_status = 'failed',
                            completed_at = NOW(),
                            error_message = 'Rollback function returned false'
                        WHERE id = %s
                    """,
                        (rollback_id,),
                    )

                    raise RollbackError("Rollback function failed")

        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False

    def cleanup_rollback_artifacts(
        self, migration_name: str, older_than_days: int = 30
    ) -> bool:
        """Clean up old rollback artifacts"""
        if not self.pg_conn:
            self.connect_postgresql()

        try:
            with self.pg_conn.cursor() as cursor:
                # Get old backup tables
                cursor.execute(
                    """
                    SELECT DISTINCT backup_location
                    FROM migration_rollback
                    WHERE migration_name = %s
                    AND rollback_status = 'completed'
                    AND started_at < NOW() - INTERVAL '%s days'
                """,
                    (migration_name, older_than_days),
                )

                backup_tables = [row[0] for row in cursor.fetchall()]

                if not backup_tables:
                    logger.info(f"No old backup tables found for {migration_name}")
                    return True

                # Drop old backup tables
                for table in backup_tables:
                    try:
                        cursor.execute(f"DROP TABLE IF EXISTS {table}")
                        logger.info(f"Dropped old backup table: {table}")
                    except Exception as e:
                        logger.error(f"Failed to drop backup table {table}: {e}")

                # Clean up old rollback records
                cursor.execute(
                    """
                    DELETE FROM migration_rollback
                    WHERE migration_name = %s
                    AND rollback_status = 'completed'
                    AND started_at < NOW() - INTERVAL '%s days'
                """,
                    (migration_name, older_than_days),
                )

                deleted_count = cursor.rowcount
                logger.info(f"Cleaned up {deleted_count} old rollback records")

                return True

        except Exception as e:
            logger.error(f"Cleanup failed: {e}")
            return False

    def generate_rollback_report(self, migration_name: str = None) -> str:
        """Generate a rollback status report"""
        if not self.pg_conn:
            self.connect_postgresql()

        try:
            with self.pg_conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cursor:
                if migration_name:
                    # Report for specific migration
                    cursor.execute(
                        """
                        SELECT
                            mr.*,
                            ms.status as migration_status,
                            ms.records_processed,
                            ms.records_total
                        FROM migration_rollback mr
                        JOIN migration_status ms ON mr.migration_name = ms.migration_name
                        WHERE mr.migration_name = %s
                        ORDER BY mr.started_at DESC
                    """,
                        (migration_name,),
                    )
                else:
                    # Report for all migrations
                    cursor.execute(
                        """
                        SELECT
                            mr.*,
                            ms.status as migration_status,
                            ms.records_processed,
                            ms.records_total
                        FROM migration_rollback mr
                        JOIN migration_status ms ON mr.migration_name = ms.migration_name
                        ORDER BY mr.started_at DESC
                    """
                    )

                results = cursor.fetchall()

                report = []
                report.append("=" * 80)
                report.append("MIGRATION ROLLBACK REPORT")
                report.append("=" * 80)
                report.append(f"Generated: {datetime.now().isoformat()}")
                report.append("")

                if not results:
                    report.append("No rollback operations found.")
                else:
                    for row in results:
                        report.append(f"Migration: {row['migration_name']}")
                        report.append(f"  Migration Status: {row['migration_status']}")
                        report.append(f"  Rollback Status: {row['rollback_status']}")
                        report.append(f"  Backup Location: {row['backup_location']}")
                        report.append(f"  Started: {row['started_at']}")
                        report.append(f"  Completed: {row['completed_at']}")
                        if row["rollback_reason"]:
                            report.append(f"  Reason: {row['rollback_reason']}")
                        if row["error_message"]:
                            report.append(f"  Error: {row['error_message']}")
                        report.append(
                            f"  Records: {row['records_processed']}/{row['records_total']}"
                        )
                        report.append("-" * 40)

                report.append("=" * 80)
                return "\n".join(report)

        except Exception as e:
            logger.error(f"Failed to generate rollback report: {e}")
            return f"Error generating report: {e}"


def main():
    """Main rollback script entry point"""
    parser = argparse.ArgumentParser(description="AiLert Migration Rollback Tool")
    parser.add_argument(
        "--action",
        choices=["list", "details", "rollback", "cleanup", "report"],
        default="list",
        help="Action to perform",
    )
    parser.add_argument("--migration", help="Migration name for specific operations")
    parser.add_argument(
        "--confirm", action="store_true", help="Confirm rollback operation"
    )
    parser.add_argument(
        "--older-than-days", type=int, default=30, help="Days for cleanup threshold"
    )
    parser.add_argument("--pg-host", default="localhost", help="PostgreSQL host")
    parser.add_argument("--pg-port", default="5432", help="PostgreSQL port")
    parser.add_argument("--pg-database", default="ailert", help="PostgreSQL database")
    parser.add_argument("--pg-user", default="postgres", help="PostgreSQL user")
    parser.add_argument("--pg-password", help="PostgreSQL password")

    args = parser.parse_args()

    # Get PostgreSQL password from environment if not provided
    pg_password = args.pg_password or os.getenv("POSTGRES_PASSWORD")
    if not pg_password:
        logger.error(
            "PostgreSQL password must be provided via --pg-password or POSTGRES_PASSWORD env var"
        )
        sys.exit(1)

    # PostgreSQL configuration
    pg_config = {
        "host": args.pg_host,
        "port": args.pg_port,
        "database": args.pg_database,
        "user": args.pg_user,
        "password": pg_password,
    }

    # Create rollback instance
    rollback = MigrationRollback(pg_config)

    try:
        if args.action == "list":
            rollbacks = rollback.list_available_rollbacks()
            print("\nAvailable Rollback Operations:")
            print("-" * 80)
            for rb in rollbacks:
                print(f"Migration: {rb['migration_name']}")
                print(f"  Status: {rb['status']}")
                print(f"  Completed: {rb['completed_at']}")
                print(f"  Records: {rb['records_processed']}/{rb['records_total']}")
                print(f"  Rollback Available: {rb['rollback_status']}")
                print("-" * 40)

        elif args.action == "details":
            if not args.migration:
                logger.error("Migration name required for details")
                sys.exit(1)

            details = rollback.get_migration_details(args.migration)
            if details:
                print(f"\nMigration Details: {args.migration}")
                print("-" * 80)
                print(json.dumps(details, indent=2, default=str))
            else:
                print(f"Migration {args.migration} not found")

        elif args.action == "rollback":
            if not args.migration:
                logger.error("Migration name required for rollback")
                sys.exit(1)

            success = rollback.perform_rollback(args.migration, args.confirm)
            sys.exit(0 if success else 1)

        elif args.action == "cleanup":
            if not args.migration:
                logger.error("Migration name required for cleanup")
                sys.exit(1)

            success = rollback.cleanup_rollback_artifacts(
                args.migration, args.older_than_days
            )
            sys.exit(0 if success else 1)

        elif args.action == "report":
            report = rollback.generate_rollback_report(args.migration)
            print(report)

    except KeyboardInterrupt:
        logger.info("Operation interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Operation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
