from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, List, Dict, Any
from datetime import datetime


class Vocab(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1, index=True)
    word: str = Field(index=True)
    original_context: Optional[str] = None
    pronunciation: Optional[str] = None
    # Fix: use default_factory to avoid shared mutable defaults across instances
    synonyms: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    collocations: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    example_sentences: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    scraped_media: Optional[Dict[str, Any]] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Parrot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1, index=True)
    sentence: str
    explanation: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
