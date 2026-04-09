import logging
import re
from sqlmodel import create_engine, SQLModel, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# SQLite needs check_same_thread=False; PostgreSQL does not need it.
# We detect which DB is in use from the connection string prefix.
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
# In the future, this can point to Postgres vs SQLite cleanly via Env
sqlite_url = settings.DATABASE_URL
connect_args = {"check_same_thread": False} if sqlite_url.startswith("sqlite") else {}
engine = create_engine(sqlite_url, echo=False, connect_args=connect_args)

def create_db_and_tables():
    # Mask password for safe diagnostic logging
    safe_url = re.sub(r':([^@]+)@', ':****@', sqlite_url)
    logger.info(f"Database Diagnostic - URL: {safe_url}")

    # Check for common username mistake
    if not sqlite_url.startswith("sqlite") and "://" in sqlite_url:
        try:
            user_part = sqlite_url.split("://")[1].split(":")[0]
            if user_part == "postgres":
                 logger.error("🛑 CRITICAL: You are using the username 'postgres' with the cloud pooler. This is why authentication is failing. You must use 'postgres.[YOUR-PROJECT-REF]'. Check CLOUD_SETUP_GUIDE.md.")
        except Exception:
            pass

    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
