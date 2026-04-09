from sqlmodel import create_engine, SQLModel, Session
from app.core.config import settings

# SQLite needs check_same_thread=False; PostgreSQL does not need it.
# We detect which DB is in use from the connection string prefix.
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
# In the future, this can point to Postgres vs SQLite cleanly via Env
sqlite_url = settings.DATABASE_URL
connect_args = {"check_same_thread": False} if sqlite_url.startswith("sqlite") else {}

engine = create_engine(sqlite_url, echo=False, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
