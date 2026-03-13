from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.database import async_session, engine
from backend.models import Base
from backend.routers import accounts, categories, dashboard, statements, transactions
from backend.services.seed import seed_categories


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Enable WAL mode for better concurrent access
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA busy_timeout=5000"))
    # Create tables on startup (dev convenience; use alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed default categories
    async with async_session() as db:
        await seed_categories(db)
    yield


app = FastAPI(title="Easy Banker", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5179"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(statements.router)
app.include_router(transactions.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(dashboard.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
