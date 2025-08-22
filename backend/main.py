import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import query, azure, system, user_queries, data_documents

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query.router, prefix="/query", tags=["Query"])
app.include_router(azure.router, prefix="/azure", tags=["Azure"])
app.include_router(system.router, prefix="/system", tags=["System"])
app.include_router(user_queries.router, prefix="/user", tags=["User Queries"])
app.include_router(data_documents.router, prefix="/data", tags=["Data Documents"])

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
