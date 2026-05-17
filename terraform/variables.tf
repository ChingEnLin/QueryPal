variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "gen-lang-client-0698668474"
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "europe-west1"
}

variable "vpc_network" {
  description = "VPC network name to attach the connector to"
  type        = string
  default     = "default"
}

variable "vpc_connector_name" {
  description = "Serverless VPC Access connector name"
  type        = string
  default     = "querypal-vpc-connector"
}

variable "vpc_connector_cidr" {
  description = "Unused /28 CIDR block for the VPC connector (must not overlap existing subnets)"
  type        = string
  default     = "10.8.0.0/28"
}

variable "cloud_sql_instance_name" {
  description = "Cloud SQL instance name"
  type        = string
  default     = "querypal-db"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "querypal"
}

variable "cloud_run_sa_name" {
  description = "Service account ID for Cloud Run services"
  type        = string
  default     = "querypal-cloudrun-sa"
}

variable "github_actions_sa_email" {
  description = "Email of the service account used by GitHub Actions"
  type        = string
  default     = "github-actions@gen-lang-client-0698668474.iam.gserviceaccount.com"
}
