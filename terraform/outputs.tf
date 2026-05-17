output "vpc_connector_id" {
  description = "Full resource ID of the Serverless VPC Access connector"
  value       = google_vpc_access_connector.querypal.id
}

output "vpc_connector_name" {
  description = "Short name of the VPC connector (for use in gcloud / CI flags)"
  value       = google_vpc_access_connector.querypal.name
}

output "cloud_run_sa_email" {
  description = "Email of the Cloud Run service account"
  value       = google_service_account.cloudrun_sa.email
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name (for --add-cloudsql-instances flag)"
  value       = google_sql_database_instance.querypal_db.connection_name
}

output "secret_ids" {
  description = "Secret Manager secret IDs managed by Terraform"
  value       = [for s in google_secret_manager_secret.querypal : s.secret_id]
}
