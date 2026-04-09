from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Any

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "IELTS Daily API"
    CORS_ORIGINS: Any = ["*"]  # For dev, all origins. In prod, configure explicitly via env.

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str) and not v.strip().startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str):
            import json
            return json.loads(v)
        return v
    
    # DB
    DATABASE_URL: str = "sqlite:///./ielts_daily.db"
    
    # API Keys
    GROQ_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""
    
    # Validation constraints
    MAX_WORD_LENGTH: int = 60
    MAX_CONTEXT_LENGTH: int = 500
    MAX_RAW_TASK_LENGTH: int = 15000
    MAX_SUBMISSION_LENGTH: int = 10000

    # JWT Auth
    SECRET_KEY: str = "super-secret-key-change-this-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
