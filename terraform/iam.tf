# Dedicated service account for the Cloud Run backend and frontend services.
# Using a least-privilege SA instead of the default Compute SA reduces blast radius.
resource "google_service_account" "cloudrun_sa" {
  account_id   = var.cloud_run_sa_name
  display_name = "QueryPal Cloud Run Service Account"
  description  = "Used by querypal-backend and querypal-frontend Cloud Run services"
}

# Allow Cloud Run SA to read Secret Manager secrets at runtime.
resource "google_project_iam_member" "cloudrun_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Allow Cloud Run SA to connect to Cloud SQL instances.
resource "google_project_iam_member" "cloudrun_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Allow Cloud Run SA to use the VPC connector.
resource "google_project_iam_member" "cloudrun_vpc_user" {
  project = var.project_id
  role    = "roles/vpcaccess.user"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Allow the github-actions SA to read secrets so it can populate them during
# first-time bootstrap (optional — remove if you populate secrets manually).
resource "google_project_iam_member" "github_actions_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${var.github_actions_sa_email}"
}

# Allow GitHub Actions SA to act as the Cloud Run SA when deploying services
# (required to set --service-account on Cloud Run deployments).
resource "google_service_account_iam_member" "github_actions_act_as_cloudrun_sa" {
  service_account_id = google_service_account.cloudrun_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.github_actions_sa_email}"
}
