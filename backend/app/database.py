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
# Define engine with optimized pooling for cloud environments (Supabase/Render)
if _is_sqlite:
    connect_args = {"check_same_thread": False}
    engine = create_engine(sqlite_url, echo=False, connect_args=connect_args)
else:
    # Optimized for Supabase Transaction Pooler (port 6543)
    engine = create_engine(
        sqlite_url,
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
    )

def create_db_and_tables():
    # Unbreakable primitive diagnostic logging
    try:
        if "://" in sqlite_url:
            # 1. Split protocol (e.g. postgresql://)
            after_protocol = sqlite_url.split("://")[1]
            
            # 2. Split userinfo (user:pass) and hostinfo (host:port/db)
            if "@" in after_protocol:
                # We split on the LAST @ to handle passwords containing @ (though they should be encoded)
                at_index = after_protocol.rfind("@")
                userinfo = after_protocol[:at_index]
                hostinfo = after_protocol[at_index+1:]
                
                # 3. Split username and password
                raw_username = userinfo.split(":")[0] if ":" in userinfo else userinfo
                logger.info(f"🔍 [RAW DIAGNOSTIC] Username detected: {raw_username}")
                
                # 4. Extract host and port
                raw_host_port = hostinfo.split("/")[0] if "/" in hostinfo else hostinfo
                logger.info(f"🔍 [RAW DIAGNOSTIC] Host:Port detected: {raw_host_port}")

                # Masked URL for general check
                masked_url = sqlite_url
                if ":" in userinfo:
                    password = userinfo.split(":")[1]
                    masked_url = sqlite_url.replace(password, "****")
                logger.info(f"🔍 [RAW DIAGNOSTIC] Masked URL: {masked_url}")

                if raw_username == "postgres" and not sqlite_url.startswith("sqlite"):
                     logger.error("🛑 CRITICAL: You are using the username 'postgres'. You must use 'postgres.[YOUR-PROJECT-REF]' for the cloud pooler.")
            else:
                logger.info(f"🔍 [RAW DIAGNOSTIC] No '@' found. Protocol: {sqlite_url.split('://')[0]}")
    except Exception as e:
        logger.info(f"🔍 [RAW DIAGNOSTIC] Error during logic: {e}")

    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
