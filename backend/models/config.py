from .schemas import DbConfig

DATABASE_CONFIGS = [
    DbConfig(name="Production-DB", connectionString="..."),
    DbConfig(name="Staging-DB", connectionString="..."),
    DbConfig(name="Development-DB", connectionString="...")
]