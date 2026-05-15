#!/usr/bin/env bash
# Import existing GCP resources into Terraform state.
# Run this ONCE when migrating existing infrastructure to Terraform management.
# After the import, subsequent changes should be made via Terraform only.
#
# Prerequisites:
#   - terraform init has been run
#   - gcloud is authenticated with sufficient permissions
#   - terraform.tfvars exists (copy from terraform.tfvars.example)
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-gen-lang-client-0698668474}"
INSTANCE_NAME="${INSTANCE_NAME:-querypal-db}"
DB_NAME="${DB_NAME:-querypal}"

echo "==> Initializing Terraform..."
terraform init

echo "==> Importing Cloud SQL instance '${INSTANCE_NAME}'..."
terraform import \
  google_sql_database_instance.querypal_db \
  "${PROJECT_ID}/${INSTANCE_NAME}" || echo "  Already imported or not found — skipping."

echo "==> Importing Cloud SQL database '${DB_NAME}'..."
terraform import \
  google_sql_database.querypal \
  "${PROJECT_ID}/${INSTANCE_NAME}/${DB_NAME}" || echo "  Already imported or not found — skipping."

echo "==> Import complete. Running 'terraform plan' to review state..."
terraform plan -out=tfplan

echo ""
echo "Review the plan above. If it looks correct, apply with:"
echo "  terraform apply tfplan"
