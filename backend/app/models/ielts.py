from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, Dict, Any, List
from datetime import datetime

class IELTSListeningTest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1, index=True)
    topic: Optional[str] = None
    full_transcript: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class IELTSListeningSection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_id: int = Field(index=True)
    section_number: int  # 1 to 4
    title: str
    transcript_segment: str
    drive_audio_url: Optional[str] = None
    questions: Optional[List[Dict[str, Any]]] = Field(default_factory=list, sa_column=Column(JSON))

class IELTSReadingTest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1, index=True)
    topic: Optional[str] = None
    full_text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class IELTSReadingPassage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_id: int = Field(index=True)
    passage_number: int  # 1 to 3
    title: str
    content: str
    questions: Optional[List[Dict[str, Any]]] = Field(default_factory=list, sa_column=Column(JSON))

class IELTSWritingTest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1, index=True)
    topic: Optional[str] = "Writing Test"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class IELTSWritingTaskRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_id: int = Field(index=True)
    task_number: int  # 1 or 2
    title: str = ""
    transcript_segment: str = ""
    brief_content: str
    user_submission: str
    correction_feedback: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class IELTSSpeakingTest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1, index=True)
    topic: Optional[str] = "Speaking Test"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class IELTSSpeakingPartRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_id: int = Field(index=True)
    part_number: int  # 1, 2, or 3
    title: str = ""
    transcript_segment: str = ""
    brief_content: str
    user_audio_url: Optional[str] = None
    correction_feedback: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DailyJournal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1, index=True)
    topic: Optional[str] = "Daily Journal"
    user_submission: str
    correction_feedback: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class IELTSStudyMaterial(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1, index=True)
    type: str  # "reading" or "listening"
    topic: str
    content: str
    drive_audio_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
