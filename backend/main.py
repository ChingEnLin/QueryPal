import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import query, azure, system, user_queries, data_documents, audit

app = FastAPI()

# Configure CORS origins based on environment
# Check for production indicators
is_production = (
    os.getenv("ENVIRONMENT") == "production"
    or os.getenv("K_SERVICE") is not None  # Google Cloud Run
)

if is_production:
    # Production: Only allow specific origins
    allowed_origins = [
        "https://querypal.virtonomy.io",  # Production frontend
        "https://querypal-frontend-zynyyoxona-ew.a.run.app",  # Cloud Run frontend URL (pattern)
        # Add your actual Cloud Run frontend URL when you know it
    ]
else:
    # Development: Allow localhost origins
    allowed_origins = [
        "http://localhost:8000",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:5173",
    ]

print(f"🔧 CORS Configuration - Production mode: {is_production}")
print(f"🌐 Allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "cors_production_mode": is_production,
    }


app.include_router(query.router, prefix="/query", tags=["Query"])
app.include_router(azure.router, prefix="/azure", tags=["Azure"])
app.include_router(system.router, prefix="/system", tags=["System"])
app.include_router(user_queries.router, prefix="/user", tags=["User Queries"])
app.include_router(data_documents.router, prefix="/data", tags=["Data Documents"])
app.include_router(audit.router, prefix="/audit", tags=["Audit"])

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
