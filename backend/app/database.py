import logging
import re
import urllib.parse
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
    # Diagnostic logging using proper parsing
    try:
        # We need to handle the fact that some schemes might be postgresql://
        # urlparse works well for standard URIs
        parsed = urllib.parse.urlparse(sqlite_url)
        
        # Mask password securely
        safe_url = sqlite_url
        if parsed.password:
            safe_url = sqlite_url.replace(parsed.password, "****")
            
        logger.info(f"🔍 [DB DIAGNOSTIC] Username: {parsed.username}")
        logger.info(f"🔍 [DB DIAGNOSTIC] Host: {parsed.hostname}")
        logger.info(f"🔍 [DB DIAGNOSTIC] Port: {parsed.port}")
        logger.info(f"🔍 [DB DIAGNOSTIC] Masked URL: {safe_url}")

        # Check for common username mistake
        if parsed.username == "postgres" and not sqlite_url.startswith("sqlite"):
             logger.error("🛑 CRITICAL: You are using the username 'postgres' with the cloud pooler. This is why authentication is failing. You must use 'postgres.[YOUR-PROJECT-REF]'. Check CLOUD_SETUP_GUIDE.md.")
    except Exception as e:
        logger.info(f"Diagnostic Log Error: {e}")

    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
