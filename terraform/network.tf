# Enable the Serverless VPC Access API (required before creating a connector).
resource "google_project_service" "vpcaccess" {
  service            = "vpcaccess.googleapis.com"
  disable_on_destroy = false
}

# Serverless VPC Access connector — lets Cloud Run services reach the VPC
# (and therefore Cloud SQL private IP and internal Cloud Run services).
resource "google_vpc_access_connector" "querypal" {
  name    = var.vpc_connector_name
  region  = var.region
  network = var.vpc_network

  # Reserve a /28 block that does not overlap any existing subnets.
  ip_cidr_range = var.vpc_connector_cidr

  min_instances = 2
  max_instances = 3
  machine_type  = "e2-micro"

  depends_on = [google_project_service.vpcaccess]
}
