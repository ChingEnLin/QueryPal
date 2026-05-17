# Existing Cloud SQL instance brought under Terraform management.
# Run ./import.sh once to import the existing instance into Terraform state
# before applying this configuration.
resource "google_sql_database_instance" "querypal_db" {
  name             = var.cloud_sql_instance_name
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-f1-micro"

    backup_configuration {
      enabled                        = false
      start_time                     = "03:00"
      point_in_time_recovery_enabled = false
      transaction_log_retention_days = 7
    }

    ip_configuration {
      ipv4_enabled = true
      # Require SSL for all connections.
      ssl_mode = "ENCRYPTED_ONLY"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }
  }

  # Prevent accidental destruction of the production database.
  deletion_protection = true
}

resource "google_sql_database" "querypal" {
  name     = var.db_name
  instance = google_sql_database_instance.querypal_db.name
}
