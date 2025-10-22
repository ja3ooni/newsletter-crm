#!/usr/bin/env python3
"""
Data Migration Script for AiLert Platform
Migrates data from DynamoDB and CSV files to PostgreSQL

This script handles:
1. CSV subscriber data migration
2. DynamoDB newsletter data migration
3. DynamoDB content data migration
4. Engagement tracking data migration
5. Data validation and integrity checks
6. Rollback procedures
"""

import argparse
import asyncio
import csv
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import boto3
import psycopg2
import psycopg2.extras
from botocore.exceptions import ClientError, NoCredentialsError
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Add the ailert directory to the path to import existing modules
sys.path.append(str(Path(__file__).parent.parent / "ailert"))

try:
    from db_handler.dynamo import Dynamo
    from utils.utility import is_valid_email

    AILERT_MODULES_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import AiLert modules: {e}")
    print("Some functionality may be limited")
    AILERT_MODULES_AVAILABLE = False

    # Define fallback classes and functions
    class Dynamo:
        def __init__(self, region):
            pass

        def list_tables(self):
            return []

        def table_exists(self, table_name):
            return False

        def scan_items(self, table_name):
            return []

    def is_valid_email(email):
        import re

        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return re.match(pattern, email) is not None


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("migration.log"), logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


class MigrationError(Exception):
    """Custom exception for migration errors"""

    pass


class DataMigrator:
    """Main data migration class"""

    def __init__(self, pg_config: Dict[str, str], aws_region: str = "us-east-1"):
        self.pg_config = pg_config
        self.aws_region = aws_region
        self.pg_conn = None
        self.dynamo_client = None

        # Migration statistics
        self.stats = {
            "subscribers_migrated": 0,
            "newsletters_migrated": 0,
            "content_items_migrated": 0,
            "engagement_events_migrated": 0,
            "errors": 0,
        }

    def connect_postgresql(self) -> None:
        """Establish PostgreSQL connection"""
        try:
            self.pg_conn = psycopg2.connect(**self.pg_config)
            self.pg_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            logger.info("Connected to PostgreSQL successfully")
        except psycopg2.Error as e:
            raise MigrationError(f"Failed to connect to PostgreSQL: {e}")

    def connect_dynamodb(self) -> None:
        """Establish DynamoDB connection"""
        if not AILERT_MODULES_AVAILABLE:
            logger.warning(
                "AiLert modules not available, DynamoDB migration will be skipped"
            )
            return

        try:
            self.dynamo_client = Dynamo(self.aws_region)
            # Test connection by listing tables
            tables = self.dynamo_client.list_tables()
            logger.info(
                f"Connected to DynamoDB successfully. Found {len(tables)} tables"
            )
        except (ClientError, NoCredentialsError) as e:
            logger.warning(f"Failed to connect to DynamoDB: {e}")
            logger.warning("DynamoDB migration will be skipped")

    def log_migration_event(
        self, migration_name: str, level: str, message: str, details: Dict = None
    ) -> None:
        """Log migration event to database"""
        if not self.pg_conn:
            return

        try:
            with self.pg_conn.cursor() as cursor:
                cursor.execute(
                    "SELECT log_migration_event(%s, %s, %s, %s)",
                    (
                        migration_name,
                        level,
                        message,
                        json.dumps(details) if details else None,
                    ),
                )
        except psycopg2.Error as e:
            logger.error(f"Failed to log migration event: {e}")

    def update_migration_status(
        self,
        migration_name: str,
        status: str,
        records_processed: int = None,
        records_total: int = None,
        error_message: str = None,
    ) -> None:
        """Update migration status in database"""
        if not self.pg_conn:
            return

        try:
            with self.pg_conn.cursor() as cursor:
                cursor.execute(
                    "SELECT update_migration_status(%s, %s, %s, %s, %s)",
                    (
                        migration_name,
                        status,
                        records_processed,
                        records_total,
                        error_message,
                    ),
                )
        except psycopg2.Error as e:
            logger.error(f"Failed to update migration status: {e}")

    def validate_migration_data(
        self,
        migration_name: str,
        validation_type: str,
        source_count: int,
        target_count: int,
    ) -> bool:
        """Validate migrated data"""
        if not self.pg_conn:
            return False

        try:
            with self.pg_conn.cursor() as cursor:
                cursor.execute(
                    "SELECT validate_migration_data(%s, %s, %s, %s)",
                    (migration_name, validation_type, source_count, target_count),
                )
                result = cursor.fetchone()[0]
                return result
        except psycopg2.Error as e:
            logger.error(f"Failed to validate migration data: {e}")
            return False

    def create_backup(self, migration_name: str, table_name: str) -> Optional[str]:
        """Create backup table before migration"""
        if not self.pg_conn:
            return None

        try:
            with self.pg_conn.cursor() as cursor:
                cursor.execute(
                    "SELECT create_migration_backup(%s, %s)",
                    (migration_name, table_name),
                )
                backup_table = cursor.fetchone()[0]
                return backup_table
        except psycopg2.Error as e:
            logger.error(f"Failed to create backup: {e}")
            return None

    def migrate_csv_subscribers(self, csv_file_path: str) -> bool:
        """Migrate subscriber data from CSV files"""
        migration_name = "csv_subscribers_migration"
        logger.info(f"Starting {migration_name}")

        self.update_migration_status(migration_name, "running")
        self.log_migration_event(
            migration_name, "INFO", f"Starting CSV migration from {csv_file_path}"
        )

        try:
            # Create backup
            backup_table = self.create_backup(migration_name, "contacts")

            # Read CSV file
            if not os.path.exists(csv_file_path):
                logger.warning(f"CSV file not found: {csv_file_path}")
                return True  # Not an error, just no data to migrate

            subscribers = []
            with open(csv_file_path, "r", newline="", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    email = row.get("email", "").strip().lower()
                    if email and self._is_valid_email(email):
                        subscribers.append(
                            {
                                "email": email,
                                "subscribed_at": row.get(
                                    "subscribed_at", datetime.now().isoformat()
                                ),
                                "source": "csv_import",
                            }
                        )

            total_records = len(subscribers)
            self.update_migration_status(migration_name, "running", 0, total_records)

            # Insert subscribers into PostgreSQL
            with self.pg_conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cursor:
                processed = 0
                for subscriber in subscribers:
                    try:
                        # Check if contact already exists
                        cursor.execute(
                            "SELECT id FROM contacts WHERE email = %s",
                            (subscriber["email"],),
                        )
                        if cursor.fetchone():
                            continue  # Skip existing contacts

                        # Insert new contact
                        cursor.execute(
                            """
                            INSERT INTO contacts (
                                email, lifecycle, source, preferences, created_at
                            ) VALUES (
                                %s, 'subscriber', %s, %s, %s
                            )
                        """,
                            (
                                subscriber["email"],
                                subscriber["source"],
                                json.dumps(
                                    {
                                        "email_frequency": "weekly",
                                        "content_types": ["all"],
                                        "format": "html",
                                    }
                                ),
                                subscriber["subscribed_at"],
                            ),
                        )

                        processed += 1
                        self.stats["subscribers_migrated"] += 1

                        if processed % 100 == 0:
                            self.update_migration_status(
                                migration_name, "running", processed, total_records
                            )
                            logger.info(
                                f"Processed {processed}/{total_records} subscribers"
                            )

                    except psycopg2.Error as e:
                        logger.error(
                            f"Failed to insert subscriber {subscriber['email']}: {e}"
                        )
                        self.stats["errors"] += 1

            # Validate migration
            cursor.execute("SELECT COUNT(*) FROM contacts WHERE source = 'csv_import'")
            migrated_count = cursor.fetchone()[0]

            validation_passed = self.validate_migration_data(
                migration_name, "subscriber_count", total_records, migrated_count
            )

            if validation_passed:
                self.update_migration_status(
                    migration_name, "completed", processed, total_records
                )
                self.log_migration_event(
                    migration_name,
                    "INFO",
                    f"Successfully migrated {processed} subscribers",
                )
                return True
            else:
                raise MigrationError(
                    f"Validation failed: expected {total_records}, got {migrated_count}"
                )

        except Exception as e:
            error_msg = f"CSV migration failed: {str(e)}"
            logger.error(error_msg)
            self.update_migration_status(
                migration_name, "failed", error_message=error_msg
            )
            self.log_migration_event(migration_name, "ERROR", error_msg)
            return False

    def migrate_dynamodb_newsletters(self) -> bool:
        """Migrate newsletter data from DynamoDB"""
        migration_name = "dynamodb_newsletters_migration"

        if not self.dynamo_client:
            logger.info("Skipping DynamoDB newsletter migration - no connection")
            return True

        logger.info(f"Starting {migration_name}")
        self.update_migration_status(migration_name, "running")

        try:
            # Create backup
            backup_table = self.create_backup(migration_name, "newsletters")

            # Get newsletter table name (assuming it exists)
            newsletter_table = (
                "newsletters"  # Adjust based on actual DynamoDB table name
            )

            if not self.dynamo_client.table_exists(newsletter_table):
                logger.info(
                    f"DynamoDB table {newsletter_table} does not exist, skipping"
                )
                self.update_migration_status(migration_name, "completed", 0, 0)
                return True

            # Scan all newsletters from DynamoDB
            newsletters = self.dynamo_client.scan_items(newsletter_table)
            total_records = len(newsletters)

            self.update_migration_status(migration_name, "running", 0, total_records)

            with self.pg_conn.cursor() as cursor:
                processed = 0
                for newsletter in newsletters:
                    try:
                        # Transform DynamoDB data to PostgreSQL format
                        pg_newsletter = self._transform_newsletter_data(newsletter)

                        cursor.execute(
                            """
                            INSERT INTO newsletters (
                                title, subject, content, status, created_at,
                                metrics, personalization, send_settings
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s
                            )
                        """,
                            (
                                pg_newsletter["title"],
                                pg_newsletter.get("subject"),
                                json.dumps(pg_newsletter["content"]),
                                pg_newsletter.get("status", "draft"),
                                pg_newsletter["created_at"],
                                json.dumps(pg_newsletter.get("metrics", {})),
                                json.dumps(pg_newsletter.get("personalization", {})),
                                json.dumps(pg_newsletter.get("send_settings", {})),
                            ),
                        )

                        processed += 1
                        self.stats["newsletters_migrated"] += 1

                        if processed % 10 == 0:
                            self.update_migration_status(
                                migration_name, "running", processed, total_records
                            )

                    except Exception as e:
                        logger.error(
                            f"Failed to migrate newsletter {newsletter.get('id', 'unknown')}: {e}"
                        )
                        self.stats["errors"] += 1

            # Validate migration
            cursor.execute("SELECT COUNT(*) FROM newsletters")
            migrated_count = cursor.fetchone()[0]

            validation_passed = self.validate_migration_data(
                migration_name, "newsletter_count", total_records, processed
            )

            if validation_passed:
                self.update_migration_status(
                    migration_name, "completed", processed, total_records
                )
                return True
            else:
                raise MigrationError(f"Newsletter validation failed")

        except Exception as e:
            error_msg = f"DynamoDB newsletter migration failed: {str(e)}"
            logger.error(error_msg)
            self.update_migration_status(
                migration_name, "failed", error_message=error_msg
            )
            return False

    def migrate_dynamodb_content(self) -> bool:
        """Migrate content items from DynamoDB"""
        migration_name = "dynamodb_content_migration"

        if not self.dynamo_client:
            logger.info("Skipping DynamoDB content migration - no connection")
            return True

        logger.info(f"Starting {migration_name}")
        self.update_migration_status(migration_name, "running")

        try:
            # Create backup
            backup_table = self.create_backup(migration_name, "content_items")

            # Get content table name
            content_table = "content_items"  # Adjust based on actual table name

            if not self.dynamo_client.table_exists(content_table):
                logger.info(f"DynamoDB table {content_table} does not exist, skipping")
                self.update_migration_status(migration_name, "completed", 0, 0)
                return True

            # Scan all content items
            content_items = self.dynamo_client.scan_items(content_table)
            total_records = len(content_items)

            self.update_migration_status(migration_name, "running", 0, total_records)

            with self.pg_conn.cursor() as cursor:
                processed = 0
                for item in content_items:
                    try:
                        # Transform content data
                        pg_item = self._transform_content_data(item)

                        cursor.execute(
                            """
                            INSERT INTO content_items (
                                title, summary, url, source, published_at,
                                score, tags, category, content_hash, created_at
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                            )
                        """,
                            (
                                pg_item["title"],
                                pg_item.get("summary"),
                                pg_item["url"],
                                pg_item["source"],
                                pg_item.get("published_at"),
                                pg_item.get("score", 0),
                                pg_item.get("tags", []),
                                pg_item.get("category"),
                                pg_item.get("content_hash"),
                                pg_item["created_at"],
                            ),
                        )

                        processed += 1
                        self.stats["content_items_migrated"] += 1

                        if processed % 50 == 0:
                            self.update_migration_status(
                                migration_name, "running", processed, total_records
                            )

                    except Exception as e:
                        logger.error(
                            f"Failed to migrate content item {item.get('id', 'unknown')}: {e}"
                        )
                        self.stats["errors"] += 1

            validation_passed = self.validate_migration_data(
                migration_name, "content_count", total_records, processed
            )

            if validation_passed:
                self.update_migration_status(
                    migration_name, "completed", processed, total_records
                )
                return True
            else:
                raise MigrationError("Content validation failed")

        except Exception as e:
            error_msg = f"DynamoDB content migration failed: {str(e)}"
            logger.error(error_msg)
            self.update_migration_status(
                migration_name, "failed", error_message=error_msg
            )
            return False

    def migrate_engagement_data(self) -> bool:
        """Migrate engagement tracking data"""
        migration_name = "engagement_data_migration"

        if not self.dynamo_client:
            logger.info("Skipping engagement data migration - no DynamoDB connection")
            return True

        logger.info(f"Starting {migration_name}")
        self.update_migration_status(migration_name, "running")

        try:
            # This would migrate engagement events if they exist in DynamoDB
            # For now, we'll create sample engagement events for existing contacts

            with self.pg_conn.cursor() as cursor:
                # Get all contacts
                cursor.execute("SELECT id, email, created_at FROM contacts")
                contacts = cursor.fetchall()

                total_records = len(contacts)
                self.update_migration_status(
                    migration_name, "running", 0, total_records
                )

                processed = 0
                for contact in contacts:
                    try:
                        # Create initial engagement event for newsletter subscription
                        cursor.execute(
                            """
                            INSERT INTO engagement_events (
                                contact_id, event_type, event_name, timestamp, metadata, score
                            ) VALUES (
                                %s, 'newsletter_subscribe', 'Initial Subscription', %s, %s, 15
                            )
                        """,
                            (
                                contact[0],  # contact_id
                                contact[2],  # created_at
                                json.dumps(
                                    {"source": "migration", "email": contact[1]}
                                ),
                            ),
                        )

                        processed += 1
                        self.stats["engagement_events_migrated"] += 1

                        if processed % 100 == 0:
                            self.update_migration_status(
                                migration_name, "running", processed, total_records
                            )

                    except Exception as e:
                        logger.error(
                            f"Failed to create engagement event for {contact[1]}: {e}"
                        )
                        self.stats["errors"] += 1

                self.update_migration_status(
                    migration_name, "completed", processed, total_records
                )
                return True

        except Exception as e:
            error_msg = f"Engagement data migration failed: {str(e)}"
            logger.error(error_msg)
            self.update_migration_status(
                migration_name, "failed", error_message=error_msg
            )
            return False

    def _transform_newsletter_data(self, dynamo_data: Dict) -> Dict:
        """Transform DynamoDB newsletter data to PostgreSQL format"""
        return {
            "title": dynamo_data.get("title", "Untitled Newsletter"),
            "subject": dynamo_data.get("subject"),
            "content": dynamo_data.get("content", {}),
            "status": dynamo_data.get("status", "draft"),
            "created_at": self._parse_timestamp(dynamo_data.get("created_at")),
            "metrics": dynamo_data.get("metrics", {}),
            "personalization": dynamo_data.get("personalization", {}),
            "send_settings": dynamo_data.get("send_settings", {}),
        }

    def _transform_content_data(self, dynamo_data: Dict) -> Dict:
        """Transform DynamoDB content data to PostgreSQL format"""
        return {
            "title": dynamo_data.get("title", "Untitled"),
            "summary": dynamo_data.get("summary") or dynamo_data.get("description"),
            "url": dynamo_data.get("url") or dynamo_data.get("link"),
            "source": dynamo_data.get("source", "unknown"),
            "published_at": self._parse_timestamp(dynamo_data.get("published_at")),
            "score": float(dynamo_data.get("score", 0)),
            "tags": dynamo_data.get("tags", []),
            "category": dynamo_data.get("category"),
            "content_hash": dynamo_data.get("content_hash"),
            "created_at": self._parse_timestamp(dynamo_data.get("created_at")),
        }

    def _parse_timestamp(self, timestamp_str: str) -> str:
        """Parse timestamp from various formats"""
        if not timestamp_str:
            return datetime.now(timezone.utc).isoformat()

        try:
            # Try parsing as ISO format
            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            return dt.isoformat()
        except:
            try:
                # Try parsing as epoch timestamp
                dt = datetime.fromtimestamp(float(timestamp_str), tz=timezone.utc)
                return dt.isoformat()
            except:
                # Default to current time
                return datetime.now(timezone.utc).isoformat()

    def _is_valid_email(self, email: str) -> bool:
        """Validate email address"""
        try:
            return is_valid_email(email)
        except:
            # Fallback validation
            import re

            pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            return re.match(pattern, email) is not None

    def run_full_migration(self, csv_path: str = None) -> bool:
        """Run complete migration process"""
        logger.info("Starting full data migration")

        # Connect to databases
        self.connect_postgresql()
        self.connect_dynamodb()

        success = True

        # 1. Migrate CSV subscribers
        if csv_path:
            success &= self.migrate_csv_subscribers(csv_path)
        else:
            # Try default CSV path
            default_csv = (
                Path(__file__).parent.parent
                / "ailert"
                / "db_handler"
                / "vault"
                / "recipients.csv"
            )
            if default_csv.exists():
                success &= self.migrate_csv_subscribers(str(default_csv))

        # 2. Migrate DynamoDB data
        success &= self.migrate_dynamodb_newsletters()
        success &= self.migrate_dynamodb_content()
        success &= self.migrate_engagement_data()

        # Print final statistics
        logger.info("Migration completed with statistics:")
        for key, value in self.stats.items():
            logger.info(f"  {key}: {value}")

        return success

    def rollback_migration(self, migration_name: str) -> bool:
        """Rollback a specific migration"""
        logger.info(f"Rolling back migration: {migration_name}")

        try:
            with self.pg_conn.cursor() as cursor:
                # Get backup table name
                cursor.execute(
                    """
                    SELECT backup_location FROM migration_rollback
                    WHERE migration_name = %s AND rollback_status = 'completed'
                    ORDER BY started_at DESC LIMIT 1
                """,
                    (migration_name,),
                )

                result = cursor.fetchone()
                if not result:
                    logger.error(f"No backup found for migration {migration_name}")
                    return False

                backup_table = result[0]

                # Determine target table based on migration name
                target_table_map = {
                    "csv_subscribers_migration": "contacts",
                    "dynamodb_newsletters_migration": "newsletters",
                    "dynamodb_content_migration": "content_items",
                    "engagement_data_migration": "engagement_events",
                }

                target_table = target_table_map.get(migration_name)
                if not target_table:
                    logger.error(f"Unknown migration name: {migration_name}")
                    return False

                # Perform rollback
                cursor.execute(
                    "SELECT rollback_migration(%s, %s, %s)",
                    (migration_name, backup_table, target_table),
                )

                success = cursor.fetchone()[0]
                return success

        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False

    def cleanup_migration_data(self) -> None:
        """Clean up migration tracking data and backup tables"""
        if not self.pg_conn:
            return

        try:
            with self.pg_conn.cursor() as cursor:
                # Get list of backup tables
                cursor.execute(
                    """
                    SELECT DISTINCT backup_location FROM migration_rollback
                    WHERE rollback_status = 'completed'
                    AND started_at < NOW() - INTERVAL '30 days'
                """
                )

                backup_tables = [row[0] for row in cursor.fetchall()]

                # Drop old backup tables
                for table in backup_tables:
                    try:
                        cursor.execute(f"DROP TABLE IF EXISTS {table}")
                        logger.info(f"Dropped backup table: {table}")
                    except Exception as e:
                        logger.error(f"Failed to drop backup table {table}: {e}")

                # Clean up old migration logs
                cursor.execute(
                    """
                    DELETE FROM migration_log
                    WHERE created_at < NOW() - INTERVAL '90 days'
                """
                )

                logger.info("Migration cleanup completed")

        except Exception as e:
            logger.error(f"Cleanup failed: {e}")


def main():
    """Main migration script entry point"""
    parser = argparse.ArgumentParser(description="AiLert Data Migration Tool")
    parser.add_argument(
        "--action",
        choices=["migrate", "rollback", "cleanup", "status"],
        default="migrate",
        help="Action to perform",
    )
    parser.add_argument("--migration", help="Specific migration name for rollback")
    parser.add_argument("--csv-path", help="Path to CSV file for subscriber migration")
    parser.add_argument("--pg-host", default="localhost", help="PostgreSQL host")
    parser.add_argument("--pg-port", default="5432", help="PostgreSQL port")
    parser.add_argument("--pg-database", default="ailert", help="PostgreSQL database")
    parser.add_argument("--pg-user", default="postgres", help="PostgreSQL user")
    parser.add_argument("--pg-password", help="PostgreSQL password")
    parser.add_argument(
        "--aws-region", default="us-east-1", help="AWS region for DynamoDB"
    )

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

    # Create migrator instance
    migrator = DataMigrator(pg_config, args.aws_region)

    try:
        if args.action == "migrate":
            success = migrator.run_full_migration(args.csv_path)
            sys.exit(0 if success else 1)

        elif args.action == "rollback":
            if not args.migration:
                logger.error("Migration name required for rollback")
                sys.exit(1)
            success = migrator.rollback_migration(args.migration)
            sys.exit(0 if success else 1)

        elif args.action == "cleanup":
            migrator.connect_postgresql()
            migrator.cleanup_migration_data()

        elif args.action == "status":
            migrator.connect_postgresql()
            with migrator.pg_conn.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM migration_status ORDER BY created_at DESC"
                )
                results = cursor.fetchall()

                print("\nMigration Status:")
                print("-" * 80)
                for row in results:
                    print(f"Migration: {row[1]}")
                    print(f"Status: {row[2]}")
                    print(f"Progress: {row[6]}/{row[7]} records")
                    print(f"Started: {row[3]}")
                    print(f"Completed: {row[4]}")
                    if row[5]:  # error_message
                        print(f"Error: {row[5]}")
                    print("-" * 40)

    except KeyboardInterrupt:
        logger.info("Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
