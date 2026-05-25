# Infrastructure & Deployment

## Production Topology

The frontend nginx container is the only public entry point. The backend is network-isolated and unreachable from the internet — all browser traffic goes to `/api/*` on the frontend's origin, which nginx proxies internally through the VPC connector.

```mermaid
graph TB
    Browser(["👤 Browser"])

    subgraph gcp["☁️ Google Cloud Platform — europe-west1"]
        subgraph cloudrun["Cloud Run"]
            direction TB
            Frontend["querypal-frontend\ningress: public\nnginx · serves SPA\nproxies /api/* → backend"]
            Backend["querypal-backend\ningress: internal only\nFastAPI · Uvicorn\n❌ not reachable from internet"]
        end

        subgraph vpc["VPC Network"]
            Connector["Serverless VPC\nAccess Connector\n10.8.0.0/28"]
        end

        SM[("Secret Manager\n6 secrets")]
        SQL[("Cloud SQL\nPostgreSQL")]
        GCR["Container Registry"]
        SA["Cloud Run SA\nleast-privilege"]
    end

    subgraph azure["☁️ Microsoft Azure"]
        Entra["Entra ID\nMSAL · OBO flow"]
        Cosmos[("Cosmos DB\nMongoDB API")]
    end

    Gemini["Google Gemini"]

    Browser -- "HTTPS" --> Frontend
    Frontend -. "vpc-egress: all-traffic" .-> Connector
    Connector -- "internal ingress" --> Backend
    Backend -- "Cloud SQL Proxy / unix socket" --> SQL
    Backend -- "HTTPS" --> Entra
    Backend -- "HTTPS" --> Cosmos
    Backend -- "HTTPS" --> Gemini
    SM -- "mounted at startup via --set-secrets" --> Backend
    SA -. "identity" .-> Frontend
    SA -. "identity" .-> Backend
```

## Network Security

| | Frontend | Backend |
|---|---|---|
| Cloud Run ingress | `all` (public) | `internal` (VPC only) |
| VPC egress | `all-traffic` | `private-ranges-only` |
| Internet accessible | Yes | No — 403 from GFE |
| Who can call it | Anyone | Frontend nginx via VPC connector |

---

## QueryArgus persistence

Audit reports persist to the same Cloud SQL Postgres instance the rest of QueryPal uses. The schema lives in the QueryArgus submodule (`backend/queryargus/src/queryargus/storage/schema.sql`) and is applied on backend startup via `ReportStore.init_schema()` — `CREATE TABLE IF NOT EXISTS`, idempotent, no migration tool required. A small additive `ALTER TABLE argus_reports ADD COLUMN IF NOT EXISTS created_by TEXT` runs immediately after so we can attribute runs to the caller without forking upstream DDL.

Tables created:

| Table | Purpose |
|---|---|
| `argus_reports` | One row per audit run. Full `AuditReport` lives in `raw_report` JSONB; common fields denormalised for indexed queries. `created_by` (QueryPal-added) holds the caller's email. |
| `argus_findings` | Confirmed findings per report — for indexed filtering and the cross-run history aggregation. |
| `argus_dismissed_findings` | Findings the evaluator rejected, with critique — feeds the planner's "do not re-propose" memory. |
| `argus_evaluation_records` | Full audit trail of action/finding/run gate verdicts. |

`GET /argus/runs` and `GET /argus/reports/{id}` scope reads by the caller's Azure-accessible Cosmos accounts (via OBO + `list_cosmos_resources`) — there is no separate ACL table; Azure RBAC is the source of truth. Cross-tenant fetches return 404 (not 403) so the existence of out-of-scope reports is not leaked.

---

## Secret Management

All sensitive configuration lives in **GCP Secret Manager** and is mounted into the backend container at startup via `--set-secrets`. Secrets are never passed as plain environment variables and never appear in `gcloud run describe` output.

| Secret ID | Description |
|---|---|
| `querypal-azure-tenant-id` | Microsoft Entra ID tenant |
| `querypal-azure-client-id` | Backend app registration client ID |
| `querypal-azure-client-secret` | Backend app registration client secret |
| `querypal-gemini-api-key` | Google Gemini API key |
| `querypal-db-user` | Cloud SQL PostgreSQL username |
| `querypal-db-pass` | Cloud SQL PostgreSQL password |

---

## Terraform

Cloud infrastructure is managed by Terraform in `terraform/`. The CI pipeline owns image builds and Cloud Run deployments; Terraform owns everything underneath.

| Resource | Owner |
|---|---|
| VPC connector | Terraform |
| Secret Manager secrets | Terraform |
| Cloud Run service account + IAM | Terraform |
| Cloud SQL instance & database | Terraform (imported existing) |
| Cloud Run services | CI pipeline |
| Docker images | CI pipeline |

### First-time setup

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
./import.sh      # import existing Cloud SQL — no data migration needed
terraform apply
```

After apply, populate Secret Manager before triggering any deployment:

```bash
for SECRET_ID in querypal-azure-tenant-id querypal-azure-client-id querypal-azure-client-secret querypal-gemini-api-key querypal-db-user querypal-db-pass; do
  echo -n "Enter value for ${SECRET_ID}: "
  read -rs VALUE && echo
  echo -n "${VALUE}" | gcloud secrets versions add "${SECRET_ID}" --data-file=-
done
```

---

## CI/CD Pipeline

Pushes to the `production` branch (or manual `workflow_dispatch`) trigger `.github/workflows/google-cloudrun-docker.yml`.

```mermaid
flowchart LR
    Push(["push to production"]) --> Auth

    subgraph gha["GitHub Actions"]
        Auth["Authenticate\nWorkload Identity Federation"]
        Auth --> BuildBE["Build & push\nbackend image"]
        Auth --> BuildFE["Build & push\nfrontend image"]
        BuildBE --> DeployBE["Deploy backend\n--ingress=internal\n--set-secrets\n--vpc-connector"]
        BuildFE --> DeployFE
        DeployBE -- "backend URL" --> DeployFE["Deploy frontend\nBACKEND_URL=internal URL\n--vpc-connector"]
    end

    subgraph gcp["GCP"]
        SM[("Secret Manager\nfetch at startup")]
    end

    DeployBE --> SM
    DeployFE --> Done(["✅ Live"])
```

Authentication uses Workload Identity Federation — no long-lived service account keys are stored in GitHub. The `querypal-cloudrun-sa` service account holds only the permissions it needs: `secretmanager.secretAccessor`, `cloudsql.client`, and `vpcaccess.user`.
