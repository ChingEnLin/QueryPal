# Enable Secret Manager API.
resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

locals {
  # Map of secret IDs to a human-readable description.
  secrets = {
    "querypal-azure-tenant-id"     = "Microsoft Entra ID tenant ID"
    "querypal-azure-client-id"     = "Microsoft Entra ID app client ID"
    "querypal-azure-client-secret" = "Microsoft Entra ID app client secret"
    "querypal-gemini-api-key"      = "Google Gemini API key"
    "querypal-db-user"             = "Cloud SQL PostgreSQL username"
    "querypal-db-pass"             = "Cloud SQL PostgreSQL password"
  }
}

resource "google_secret_manager_secret" "querypal" {
  for_each  = local.secrets
  secret_id = each.key

  labels = {
    managed-by = "terraform"
    app        = "querypal"
  }

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

# After 'terraform apply', populate each secret value with:
#   echo -n "VALUE" | gcloud secrets versions add SECRET_ID --data-file=-
# Or use the GCP console / a one-time bootstrap script.
