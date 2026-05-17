# QueryPal
### AI-Powered Database Assistant for Azure Cosmos DB

QueryPal lets you query, explore, and manage **Azure Cosmos DB (MongoDB API)** using natural language. Type a question, get an optimized MongoDB query and AI-generated analysis back.

**Key capabilities:**
- Natural language → MongoDB query via Google Gemini + LangGraph ReAct agent
- Paginated data explorer with filtering, multi-select, and document editing
- Saved queries, audit trails, and schema relationship graph
- Enterprise auth: Microsoft Entra ID with On-Behalf-Of (OBO) flow
- Private backend: frontend nginx proxies all API calls internally — backend is unreachable from the internet

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | FastAPI (Python 3.12), Pydantic V2 |
| AI | Google Gemini (`gemini-2.5-flash`), LangGraph |
| Auth | Microsoft Entra ID, MSAL, OBO flow |
| Databases | Azure Cosmos DB (MongoDB API), PostgreSQL (Cloud SQL) |
| Infrastructure | Google Cloud Run, Terraform, GCP Secret Manager, Serverless VPC Access |
| CI/CD | GitHub Actions, Docker, Google Container Registry |

---

## Quick Start

```bash
cp backend/.env.example backend/.env
# Fill in backend/.env — see docs/DEVELOPMENT.md for all variables
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

For dev without Azure, set `USE_MSAL_AUTH = false` in `frontend/app.config.ts` to use mock data.

---

## Documentation

| Doc | Contents |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | BFF pattern, auth flow, ReAct agent loop, security model |
| [Infrastructure](docs/INFRASTRUCTURE.md) | Cloud topology, network security, Secret Manager, Terraform setup, CI/CD pipeline |
| [Azure Setup](docs/AZURE_SETUP.md) | Entra ID app registrations, Cosmos DB permissions, frontend auth config |
| [Development](docs/DEVELOPMENT.md) | Local setup, testing commands, code style |
| [Design Handbook](DESIGN_HANDBOOK.md) | CSS tokens, utility classes, component conventions |
| [Versioning](docs/SEMANTIC_VERSIONING.md) | Semantic versioning and conventional commits |

---

## Links

- **Live**: https://querypal.virtonomy.io
- **Issues**: https://github.com/ChingEnLin/QueryPal/issues
- **License**: [MIT](LICENSE)

---

Built by [Ching-En Lin](https://github.com/ChingEnLin)
