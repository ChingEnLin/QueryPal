from fastapi import FastAPI
from api.routes import db, query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(db.router, prefix="/db", tags=["Database"])
app.include_router(query.router, prefix="/query", tags=["Query"])