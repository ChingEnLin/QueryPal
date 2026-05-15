terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment to enable remote state (recommended for teams).
  # Create the bucket first: gsutil mb -p <project_id> gs://<project_id>-tfstate
  # backend "gcs" {
  #   bucket = "gen-lang-client-0698668474-tfstate"
  #   prefix = "querypal/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
