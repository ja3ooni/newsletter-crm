#!/usr/bin/env python3
"""
Migration Validation Script for AiLert Platform
Validates data integrity after migration from DynamoDB/CSV to PostgreSQL
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import psycopg2
import psycopg2.extras

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class MigrationValidator:
    """Validates migrated data integrity and completeness"""

    def __init__(self, pg_config: Dict[str, str]):
        self.pg_config = pg_config
        self.pg_conn = None
        self.validation_results = {}

    def connect_postgresql(self) -> None:
        """Establish PostgreSQL connection"""
        try:
            self.pg_conn = psycopg2.connect(**self.pg_config)
            logger.info("Connected to PostgreSQL successfully")
        except psycopg2.Error as e:
            raise Exception(f"Failed to connect to PostgreSQL: {e}")

    def validate_contacts_data(self) -> Dict[str, Any]:
        """Validate contacts/subscribers data"""
        logger.info("Validating contacts data...")

        with self.pg_conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        ) as cursor:
            results = {
                "total_contacts": 0,
                "valid_emails": 0,
                "invalid_emails": 0,
                "duplicate_emails": 0,
                "missing_required_fields": 0,
                "contacts_with_preferences": 0,
                "contacts_with_engagement_metrics": 0,
            }

            # Total contacts
            cursor.execute("SELECT COUNT(*) FROM contacts")
            results["total_contacts"] = cursor.fetchone()[0]

            # Email validation
            cursor.execute(
                """
                SELECT COUNT(*) FROM contacts
                WHERE email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            """
            )
            results["valid_emails"] = cursor.fetchone()[0]
            results["invalid_emails"] = (
                results["total_contacts"] - results["valid_emails"]
            )

            # Duplicate emails
            cursor.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT email FROM contacts GROUP BY email HAVING COUNT(*) > 1
                ) duplicates
            """
            )
            results["duplicate_emails"] = cursor.fetchone()[0]

            # Contacts with preferences
            cursor.execute(
                """
                SELECT COUNT(*) FROM contacts
                WHERE preferences IS NOT NULL AND preferences != '{}'::jsonb
            """
            )
            results["contacts_with_preferences"] = cursor.fetchone()[0]

            # Contacts with engagement metrics
            cursor.execute(
                """
                SELECT COUNT(*) FROM contacts
                WHERE engagement_metrics IS NOT NULL AND engagement_metrics != '{}'::jsonb
            """
            )
            results["contacts_with_engagement_metrics"] = cursor.fetchone()[0]

            return results

    def validate_newsletters_data(self) -> Dict[str, Any]:
        """Validate newsletters data"""
        logger.info("Validating newsletters data...")

        with self.pg_conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        ) as cursor:
            results = {
                "total_newsletters": 0,
                "newsletters_with_content": 0,
                "newsletters_with_metrics": 0,
                "valid_statuses": 0,
                "newsletters_with_templates": 0,
            }

            # Total newsletters
            cursor.execute("SELECT COUNT(*) FROM newsletters")
            results["total_newsletters"] = cursor.fetchone()[0]

            # Newsletters with content
            cursor.execute(
                """
                SELECT COUNT(*) FROM newsletters
                WHERE content IS NOT NULL AND content != '{}'::jsonb
            """
            )
            results["newsletters_with_content"] = cursor.fetchone()[0]

            # Newsletters with metrics
            cursor.execute(
                """
                SELECT COUNT(*) FROM newsletters
                WHERE metrics IS NOT NULL AND metrics != '{}'::jsonb
            """
            )
            results["newsletters_with_metrics"] = cursor.fetchone()[0]

            # Valid statuses
            cursor.execute(
                """
                SELECT COUNT(*) FROM newsletters
                WHERE status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')
            """
            )
            results["valid_statuses"] = cursor.fetchone()[0]

            # Newsletters with templates
            cursor.execute(
                """
                SELECT COUNT(*) FROM newsletters
                WHERE template_id IS NOT NULL
            """
            )
            results["newsletters_with_templates"] = cursor.fetchone()[0]

            return results

    def validate_content_items_data(self) -> Dict[str, Any]:
        """Validate content items data"""
        logger.info("Validating content items data...")

        with self.pg_conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        ) as cursor:
            results = {
                "total_content_items": 0,
                "items_with_valid_urls": 0,
                "items_with_sources": 0,
                "items_with_tags": 0,
                "duplicate_urls": 0,
                "items_with_scores": 0,
            }

            # Total content items
            cursor.execute("SELECT COUNT(*) FROM content_items")
            results["total_content_items"] = cursor.fetchone()[0]

            # Valid URLs
            cursor.execute(
                """
                SELECT COUNT(*) FROM content_items
                WHERE url ~ '^https?://.+'
            """
            )
            results["items_with_valid_urls"] = cursor.fetchone()[0]

            # Items with sources
            cursor.execute(
                """
                SELECT COUNT(*) FROM content_items
                WHERE source IS NOT NULL AND source != ''
            """
            )
            results["items_with_sources"] = cursor.fetchone()[0]

            # Items with tags
            cursor.execute(
                """
                SELECT COUNT(*) FROM content_items
                WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
            """
            )
            results["items_with_tags"] = cursor.fetchone()[0]

            # Duplicate URLs
            cursor.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT url FROM content_items GROUP BY url HAVING COUNT(*) > 1
                ) duplicates
            """
            )
            results["duplicate_urls"] = cursor.fetchone()[0]

            # Items with scores
            cursor.execute(
                """
                SELECT COUNT(*) FROM content_items
                WHERE score IS NOT NULL AND score > 0
            """
            )
            results["items_with_scores"] = cursor.fetchone()[0]

            return results

    def validate_engagement_events_data(self) -> Dict[str, Any]:
        """Validate engagement events data"""
        logger.info("Validating engagement events data...")

        with self.pg_conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        ) as cursor:
            results = {
                "total_engagement_events": 0,
                "events_with_valid_contacts": 0,
                "events_by_type": {},
                "events_with_metadata": 0,
                "recent_events": 0,
            }

            # Total engagement events
            cursor.execute("SELECT COUNT(*) FROM engagement_events")
            results["total_engagement_events"] = cursor.fetchone()[0]

            # Events with valid contact references
            cursor.execute(
                """
                SELECT COUNT(*) FROM engagement_events ee
                WHERE EXISTS (SELECT 1 FROM contacts c WHERE c.id = ee.contact_id)
            """
            )
            results["events_with_valid_contacts"] = cursor.fetchone()[0]

            # Events by type
            cursor.execute(
                """
                SELECT event_type, COUNT(*)
                FROM engagement_events
                GROUP BY event_type
            """
            )
            results["events_by_type"] = dict(cursor.fetchall())

            # Events with metadata
            cursor.execute(
                """
                SELECT COUNT(*) FROM engagement_events
                WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb
            """
            )
            results["events_with_metadata"] = cursor.fetchone()[0]

            # Recent events (last 30 days)
            cursor.execute(
                """
                SELECT COUNT(*) FROM engagement_events
                WHERE timestamp > NOW() - INTERVAL '30 days'
            """
            )
            results["recent_events"] = cursor.fetchone()[0]

            return results

    def validate_referential_integrity(self) -> Dict[str, Any]:
        """Validate referential integrity across tables"""
        logger.info("Validating referential integrity...")

        with self.pg_conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        ) as cursor:
            results = {
                "orphaned_engagement_events": 0,
                "orphaned_contact_segments": 0,
                "orphaned_newsletter_templates": 0,
                "invalid_user_references": 0,
            }

            # Orphaned engagement events
            cursor.execute(
                """
                SELECT COUNT(*) FROM engagement_events ee
                WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = ee.contact_id)
            """
            )
            results["orphaned_engagement_events"] = cursor.fetchone()[0]

            # Orphaned contact segments
            cursor.execute(
                """
                SELECT COUNT(*) FROM contact_segments cs
                WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = cs.contact_id)
                   OR NOT EXISTS (SELECT 1 FROM segments s WHERE s.id = cs.segment_id)
            """
            )
            results["orphaned_contact_segments"] = cursor.fetchone()[0]

            # Newsletters with invalid template references
            cursor.execute(
                """
                SELECT COUNT(*) FROM newsletters n
                WHERE n.template_id IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM newsletter_templates nt WHERE nt.id = n.template_id)
            """
            )
            results["orphaned_newsletter_templates"] = cursor.fetchone()[0]

            return results

    def check_migration_completeness(self) -> Dict[str, Any]:
        """Check migration completeness against migration status"""
        logger.info("Checking migration completeness...")

        with self.pg_conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        ) as cursor:
            results = {
                "completed_migrations": [],
                "failed_migrations": [],
                "pending_migrations": [],
            }

            cursor.execute(
                """
                SELECT migration_name, status, records_processed, records_total, error_message
                FROM migration_status
                ORDER BY created_at DESC
            """
            )

            for row in cursor.fetchall():
                migration_info = {
                    "name": row["migration_name"],
                    "records_processed": row["records_processed"],
                    "records_total": row["records_total"],
                    "error_message": row["error_message"],
                }

                if row["status"] == "completed":
                    results["completed_migrations"].append(migration_info)
                elif row["status"] == "failed":
                    results["failed_migrations"].append(migration_info)
                else:
                    results["pending_migrations"].append(migration_info)

            return results

    def run_full_validation(self) -> Dict[str, Any]:
        """Run complete validation suite"""
        logger.info("Starting full migration validation")

        self.connect_postgresql()

        self.validation_results = {
            "validation_timestamp": datetime.now().isoformat(),
            "contacts": self.validate_contacts_data(),
            "newsletters": self.validate_newsletters_data(),
            "content_items": self.validate_content_items_data(),
            "engagement_events": self.validate_engagement_events_data(),
            "referential_integrity": self.validate_referential_integrity(),
            "migration_completeness": self.check_migration_completeness(),
        }

        return self.validation_results

    def generate_validation_report(self) -> str:
        """Generate human-readable validation report"""
        if not self.validation_results:
            return "No validation results available"

        report = []
        report.append("=" * 60)
        report.append("MIGRATION VALIDATION REPORT")
        report.append("=" * 60)
        report.append(f"Generated: {self.validation_results['validation_timestamp']}")
        report.append("")

        # Contacts validation
        contacts = self.validation_results["contacts"]
        report.append("CONTACTS VALIDATION:")
        report.append(f"  Total contacts: {contacts['total_contacts']}")
        report.append(f"  Valid emails: {contacts['valid_emails']}")
        report.append(f"  Invalid emails: {contacts['invalid_emails']}")
        report.append(f"  Duplicate emails: {contacts['duplicate_emails']}")
        report.append(
            f"  Contacts with preferences: {contacts['contacts_with_preferences']}"
        )
        report.append(
            f"  Contacts with engagement metrics: {contacts['contacts_with_engagement_metrics']}"
        )
        report.append("")

        # Newsletters validation
        newsletters = self.validation_results["newsletters"]
        report.append("NEWSLETTERS VALIDATION:")
        report.append(f"  Total newsletters: {newsletters['total_newsletters']}")
        report.append(
            f"  Newsletters with content: {newsletters['newsletters_with_content']}"
        )
        report.append(
            f"  Newsletters with metrics: {newsletters['newsletters_with_metrics']}"
        )
        report.append(f"  Valid statuses: {newsletters['valid_statuses']}")
        report.append("")

        # Content items validation
        content = self.validation_results["content_items"]
        report.append("CONTENT ITEMS VALIDATION:")
        report.append(f"  Total content items: {content['total_content_items']}")
        report.append(f"  Items with valid URLs: {content['items_with_valid_urls']}")
        report.append(f"  Items with sources: {content['items_with_sources']}")
        report.append(f"  Items with tags: {content['items_with_tags']}")
        report.append(f"  Duplicate URLs: {content['duplicate_urls']}")
        report.append("")

        # Engagement events validation
        engagement = self.validation_results["engagement_events"]
        report.append("ENGAGEMENT EVENTS VALIDATION:")
        report.append(
            f"  Total engagement events: {engagement['total_engagement_events']}"
        )
        report.append(
            f"  Events with valid contacts: {engagement['events_with_valid_contacts']}"
        )
        report.append(f"  Events with metadata: {engagement['events_with_metadata']}")
        report.append(f"  Recent events (30 days): {engagement['recent_events']}")
        if engagement["events_by_type"]:
            report.append("  Events by type:")
            for event_type, count in engagement["events_by_type"].items():
                report.append(f"    {event_type}: {count}")
        report.append("")

        # Referential integrity
        integrity = self.validation_results["referential_integrity"]
        report.append("REFERENTIAL INTEGRITY:")
        report.append(
            f"  Orphaned engagement events: {integrity['orphaned_engagement_events']}"
        )
        report.append(
            f"  Orphaned contact segments: {integrity['orphaned_contact_segments']}"
        )
        report.append(
            f"  Invalid newsletter templates: {integrity['orphaned_newsletter_templates']}"
        )
        report.append("")

        # Migration completeness
        completeness = self.validation_results["migration_completeness"]
        report.append("MIGRATION COMPLETENESS:")
        report.append(
            f"  Completed migrations: {len(completeness['completed_migrations'])}"
        )
        report.append(f"  Failed migrations: {len(completeness['failed_migrations'])}")
        report.append(
            f"  Pending migrations: {len(completeness['pending_migrations'])}"
        )

        if completeness["failed_migrations"]:
            report.append("\n  FAILED MIGRATIONS:")
            for migration in completeness["failed_migrations"]:
                report.append(
                    f"    - {migration['name']}: {migration['error_message']}"
                )

        report.append("")
        report.append("=" * 60)

        return "\n".join(report)

    def save_validation_results(self, output_file: str) -> None:
        """Save validation results to file"""
        with open(output_file, "w") as f:
            json.dump(self.validation_results, f, indent=2, default=str)
        logger.info(f"Validation results saved to {output_file}")


def main():
    """Main validation script entry point"""
    parser = argparse.ArgumentParser(description="AiLert Migration Validation Tool")
    parser.add_argument("--pg-host", default="localhost", help="PostgreSQL host")
    parser.add_argument("--pg-port", default="5432", help="PostgreSQL port")
    parser.add_argument("--pg-database", default="ailert", help="PostgreSQL database")
    parser.add_argument("--pg-user", default="postgres", help="PostgreSQL user")
    parser.add_argument("--pg-password", help="PostgreSQL password")
    parser.add_argument(
        "--output-file", help="Output file for validation results (JSON)"
    )
    parser.add_argument(
        "--report-file", help="Output file for validation report (text)"
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

    try:
        # Create validator and run validation
        validator = MigrationValidator(pg_config)
        results = validator.run_full_validation()

        # Generate and display report
        report = validator.generate_validation_report()
        print(report)

        # Save results if requested
        if args.output_file:
            validator.save_validation_results(args.output_file)

        if args.report_file:
            with open(args.report_file, "w") as f:
                f.write(report)
            logger.info(f"Validation report saved to {args.report_file}")

        # Check for critical issues
        critical_issues = []

        if results["contacts"]["invalid_emails"] > 0:
            critical_issues.append(
                f"Found {results['contacts']['invalid_emails']} invalid email addresses"
            )

        if results["contacts"]["duplicate_emails"] > 0:
            critical_issues.append(
                f"Found {results['contacts']['duplicate_emails']} duplicate email addresses"
            )

        if results["referential_integrity"]["orphaned_engagement_events"] > 0:
            critical_issues.append(
                f"Found {results['referential_integrity']['orphaned_engagement_events']} orphaned engagement events"
            )

        if len(results["migration_completeness"]["failed_migrations"]) > 0:
            critical_issues.append(
                f"Found {len(results['migration_completeness']['failed_migrations'])} failed migrations"
            )

        if critical_issues:
            logger.warning("Critical issues found:")
            for issue in critical_issues:
                logger.warning(f"  - {issue}")
            sys.exit(1)
        else:
            logger.info("Validation completed successfully - no critical issues found")
            sys.exit(0)

    except Exception as e:
        logger.error(f"Validation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
