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

# Static egress IP so Cloud Run's public traffic (Azure Cosmos/Postgres public
# endpoints behind IP firewalls) leaves from ONE stable address to allowlist.
# Requires the Cloud Run service to use vpc-egress=all-traffic (set via gcloud —
# the services are deployed outside Terraform).
resource "google_compute_address" "querypal_egress" {
  name   = "querypal-egress-ip"
  region = var.region
}

resource "google_compute_router" "querypal" {
  name    = "querypal-router"
  region  = var.region
  network = var.vpc_network
}

resource "google_compute_router_nat" "querypal" {
  name                               = "querypal-nat"
  router                             = google_compute_router.querypal.name
  region                             = var.region
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [google_compute_address.querypal_egress.self_link]
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}
