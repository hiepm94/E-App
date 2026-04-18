"""
app/api/ielts.py  — Reading / Listening / Writing / Journal
─────────────────────────────────────────────────────────────────────────────
Routes that call LLM services are plain `def` — FastAPI runs them in a
thread-pool automatically so the event loop is never blocked.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import get_session
from app.models.ielts import (
    IELTSListeningTest, IELTSListeningSection,
    IELTSReadingTest, IELTSReadingPassage,
    IELTSWritingTest, IELTSWritingTaskRecord,
    IELTSSpeakingTest, IELTSSpeakingPartRecord,
    DailyJournal, IELTSStudyMaterial
)
from app.services.llm import (
    evaluate_writing_task, extract_ielts_task, generate_random_ielts_material, 
    generate_writing_test, generate_speaking_test, transcribe_audio,
    generate_part_exercises
)
from app.api.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Request schemas ────────────────────────────────────────────────────────

class ImportMaterialRequest(BaseModel):
    raw_transcript: str = Field(..., min_length=10, max_length=15000)
    raw_text: str = Field("", max_length=5000)
    type: str = Field(..., pattern="^(reading|listening)$")
    drive_audio_url: Optional[str] = Field(None, max_length=500)


class SubmitWritingRequest(BaseModel):
    type: str = Field(..., pattern="^(daily_journal|ielts_brief)$")
    brief_content: str = Field("", max_length=5000)
    user_submission: str = Field(..., min_length=1, max_length=10000)

class NewStudyMaterialRequest(BaseModel):
    type: str = Field(..., pattern="^(reading|listening)$")
    topic: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=10, max_length=30000)
    drive_audio_url: Optional[str] = Field(None, max_length=500)


# ── Material (Reading / Listening) ────────────────────────────────────────

@router.post("/material", status_code=201)
async def create_material_and_task(
    req: ImportMaterialRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Persist the transcript. If the user provides raw question text → extract synchronously.
    Otherwise, save as raw material for on-demand question generation.
    """
    if req.type == "reading":
        # Generate a descriptive topic from the transcript if possible
        topic = f"Reading: {req.raw_transcript[:30].strip()}..."
        test = IELTSReadingTest(full_text=req.raw_transcript, topic=topic, user_id=current_user.id)
        session.add(test)
        session.commit()
        session.refresh(test)
        
        # If manual exercises provided, extract them
        if req.raw_text:
            extracted = await extract_ielts_task(req.raw_transcript, req.type, req.raw_text)
            parts = extracted.get("parts", [])
            if not parts:
                # AI Fallback: Create 1 study passage if extraction failed
                parts = [{"part": 1, "title": "Study Passage", "transcript_segment": req.raw_transcript, "questions": []}]
            
            for p in parts:
                passage = IELTSReadingPassage(
                    test_id=test.id,
                    passage_number=p.get("part", 1),
                    title=p.get("title", "Imported Passage"),
                    content=p.get("transcript_segment", req.raw_transcript),
                    questions=p.get("questions", [])
                )
                session.add(passage)
        else:
            # Otherwise, create one raw passage for on-demand generation
            passage = IELTSReadingPassage(
                test_id=test.id,
                passage_number=1,
                title="Study Passage",
                content=req.raw_transcript,
                questions=[]
            )
            session.add(passage)
            
    else:
        topic = f"Listening: {req.raw_transcript[:30].strip()}..."
        test = IELTSListeningTest(full_transcript=req.raw_transcript, topic=topic, user_id=current_user.id)
        session.add(test)
        session.commit()
        session.refresh(test)

        if req.raw_text:
            extracted = await extract_ielts_task(req.raw_transcript, req.type, req.raw_text)
            parts = extracted.get("parts", [])
            if not parts:
                # AI Fallback: Create 1 study section if extraction failed
                parts = [{"part": 1, "title": "Study Section", "transcript_segment": req.raw_transcript, "questions": []}]

            for p in parts:
                section = IELTSListeningSection(
                    test_id=test.id,
                    section_number=p.get("part", 1),
                    title=p.get("title", "Imported Section"),
                    transcript_segment=p.get("transcript_segment", req.raw_transcript),
                    drive_audio_url=p.get("drive_audio_url") or req.drive_audio_url,
                    questions=p.get("questions", [])
                )
                session.add(section)
        else:
            # Create one raw section for on-demand generation
            section = IELTSListeningSection(
                test_id=test.id,
                section_number=1,
                title="Study Section",
                transcript_segment=req.raw_transcript,
                drive_audio_url=req.drive_audio_url,
                questions=[]
            )
            session.add(section)
            
    session.commit()
    return {"status": "success", "test_id": test.id}

@router.get("/study-materials")
async def list_study_materials(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    materials = session.exec(
        select(IELTSStudyMaterial)
        .where(IELTSStudyMaterial.user_id == current_user.id)
        .order_by(IELTSStudyMaterial.created_at.desc())
    ).all()
    return materials

@router.post("/study-materials", status_code=201)
async def create_study_material(
    req: NewStudyMaterialRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    material = IELTSStudyMaterial(
        user_id=current_user.id,
        type=req.type,
        topic=req.topic,
        content=req.content,
        drive_audio_url=req.drive_audio_url
    )
    session.add(material)
    session.commit()
    session.refresh(material)
    return material

@router.delete("/study-materials/{material_id}")
async def delete_study_material(
    material_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    material = session.get(IELTSStudyMaterial, material_id)
    if not material or material.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Material not found")
    session.delete(material)
    session.commit()
    return {"status": "success"}


@router.post("/material/reading/part/{part_id}/generate", status_code=200)
async def generate_reading_part_questions(
    part_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    passage = session.get(IELTSReadingPassage, part_id)
    if not passage:
        raise HTTPException(status_code=404, detail="Passage not found")
    
    result = await generate_part_exercises(passage.content, "reading", part_num=passage.passage_number)
    passage.questions = result.get("questions", [])
    session.add(passage)
    session.commit()
    session.refresh(passage)
    return {"status": "success", "questions": passage.questions}


@router.post("/material/listening/part/{part_id}/generate", status_code=200)
async def generate_listening_part_questions(
    part_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    section = session.get(IELTSListeningSection, part_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    result = await generate_part_exercises(section.transcript_segment, "listening", part_num=section.section_number)
    section.questions = result.get("questions", [])
    session.add(section)
    session.commit()
    session.refresh(section)
    return {"status": "success", "questions": section.questions}

@router.post("/material/generate", status_code=201)
async def generate_daily_material(
    type: str, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if type not in ("reading", "listening"):
        raise HTTPException(status_code=400, detail="type must be 'reading' or 'listening'")
        
    ai_data = await generate_random_ielts_material(type)
    transcript = ai_data.get("transcript", "Error generating transcript")
    topic = ai_data.get("topic", f"Generated {type.capitalize()} Test")
    
    extracted = await extract_ielts_task(transcript, type)

    if type == "reading":
        parts = extracted.get("parts", [])
        if not parts:
            raise HTTPException(status_code=500, detail="AI failed to structure the test passages. Please try again.")
            
        test = IELTSReadingTest(full_text=transcript, topic=topic, user_id=current_user.id)
        session.add(test)
        session.commit()
        session.refresh(test)
        
        for p in parts:
            passage = IELTSReadingPassage(
                test_id=test.id,
                passage_number=p.get("part", 1),
                title=p.get("title", ""),
                content=p.get("transcript_segment", transcript), # Fallback if empty
                questions=p.get("questions", [])
            )
            session.add(passage)
    else:
        parts = extracted.get("parts", [])
        if not parts:
            raise HTTPException(status_code=500, detail="AI failed to structure the listening sections. Please try again.")

        test = IELTSListeningTest(full_transcript=transcript, topic=topic, user_id=current_user.id)
        session.add(test)
        session.commit()
        session.refresh(test)
        
        for p in parts:
            section = IELTSListeningSection(
                test_id=test.id,
                section_number=p.get("part", 1),
                title=p.get("title", ""),
                transcript_segment=p.get("transcript_segment", transcript), 
                drive_audio_url=p.get("drive_audio_url"),
                questions=p.get("questions", [])
            )
            session.add(section)
            
    session.commit()
    return {"status": "success", "test_id": test.id}


@router.get("/material")
async def list_materials(
    type: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if type == "reading":
        tests = session.exec(
            select(IELTSReadingTest)
            .where(IELTSReadingTest.user_id == current_user.id)
            .order_by(IELTSReadingTest.created_at.desc())
            .limit(30)
        ).all()
        result = []
        for t in tests:
            passages = session.exec(select(IELTSReadingPassage).where(IELTSReadingPassage.test_id == t.id).order_by(IELTSReadingPassage.passage_number)).all()
            result.append({
                "material": {"id": t.id, "type": "reading", "raw_transcript": t.full_text, "topic": t.topic},
                "tasks": [{"questions": {"parts": [
                    {
                        "id": p.id, 
                        "part": p.passage_number, 
                        "title": p.title, 
                        "transcript_segment": p.content, 
                        "questions": p.questions
                    } for p in passages
                ]}}]
            })
        return result
    else:
        tests = session.exec(
            select(IELTSListeningTest)
            .where(IELTSListeningTest.user_id == current_user.id)
            .order_by(IELTSListeningTest.created_at.desc())
            .limit(30)
        ).all()
        result = []
        for t in tests:
            sections = session.exec(select(IELTSListeningSection).where(IELTSListeningSection.test_id == t.id).order_by(IELTSListeningSection.section_number)).all()
            result.append({
                "material": {"id": t.id, "type": "listening", "raw_transcript": t.full_transcript, "topic": t.topic},
                "tasks": [{"questions": {"parts": [
                    {
                        "id": s.id, 
                        "part": s.section_number, 
                        "title": s.title, 
                        "transcript_segment": s.transcript_segment, 
                        "drive_audio_url": s.drive_audio_url, 
                        "questions": s.questions
                    } for s in sections
                ]}}]
            })
        return result


@router.delete("/material/{material_id}")
async def delete_material(
    material_id: int, 
    type: str = "listening", 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if type == "reading":
        test = session.get(IELTSReadingTest, material_id)
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        passages = session.exec(select(IELTSReadingPassage).where(IELTSReadingPassage.test_id == material_id)).all()
        for p in passages: session.delete(p)
        session.delete(test)
    else:
        test = session.get(IELTSListeningTest, material_id)
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        sections = session.exec(select(IELTSListeningSection).where(IELTSListeningSection.test_id == material_id)).all()
        for s in sections: session.delete(s)
        session.delete(test)
    session.commit()
    return {"status": "deleted"}


# ── Writing & Journal ─────────────────────────────────────────────────────

@router.post("/writing/journal/submit", status_code=201)
async def create_journal_entry(
    req: SubmitWritingRequest, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Creates a freestyle journal entry with AI feedback."""
    snippet = req.user_submission[:30].strip() + "..."
    topic = f"Journal - {snippet}"
    evaluation = await evaluate_writing_task(req.user_submission, "Freestyle Journal Entry")
    entry = DailyJournal(user_submission=req.user_submission, correction_feedback=evaluation, topic=topic, user_id=current_user.id)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {
        "material": {"id": f"journal_{entry.id}", "type": "daily_journal", "topic": entry.topic},
        "tasks": [{"questions": {"parts": [{"part": 1, "title": "Journal Entry", "transcript_segment": "Free writing", "brief_content": "Free Writing", "user_submission": entry.user_submission, "correction_feedback": entry.correction_feedback}]}}]
    }


@router.post("/writing/{task_id}/submit", status_code=200)
async def submit_writing_task(
    task_id: int, 
    req: SubmitWritingRequest, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    evaluation = await evaluate_writing_task(req.user_submission, req.brief_content)

    if req.type == "daily_journal":
        snippet = req.user_submission[:30].strip() + "..."
        topic = f"Journal - {snippet}"
        task = DailyJournal(user_submission=req.user_submission, correction_feedback=evaluation, topic=topic, user_id=current_user.id)
        session.add(task)
        session.commit()
        session.refresh(task)
        return {
            "material": {"id": f"journal_{task.id}", "type": "daily_journal", "topic": task.topic},
            "tasks": [{"questions": {"parts": [{"part": 1, "title": "Journal Entry", "transcript_segment": "Free writing", "brief_content": "Free writing", "user_submission": task.user_submission, "correction_feedback": task.correction_feedback}]}}]
        }
    else:
        task = session.get(IELTSWritingTaskRecord, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        task.user_submission = req.user_submission
        task.correction_feedback = evaluation
        session.add(task)
        session.commit()
        session.refresh(task)
        
        test_parent = session.get(IELTSWritingTest, task.test_id)
        return {
            "material": {"id": f"test_{task.test_id}", "type": "writing", "topic": getattr(test_parent, "topic", "Writing Test")},
            "tasks": [{"questions": {"parts": [{"part": task.task_number, "title": f"Task {task.task_number}", "transcript_segment": task.transcript_segment, "brief_content": task.brief_content, "user_submission": task.user_submission, "correction_feedback": task.correction_feedback, "db_task_id": task.id}]}}]
        }


@router.get("/writing")
async def list_writing(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    tests = session.exec(
        select(IELTSWritingTest)
        .where(IELTSWritingTest.user_id == current_user.id)
        .order_by(IELTSWritingTest.created_at.desc())
        .limit(30)
    ).all()
    journals = session.exec(
        select(DailyJournal)
        .where(DailyJournal.user_id == current_user.id)
        .order_by(DailyJournal.created_at.desc())
        .limit(30)
    ).all()
    
    result = []
    for t in tests:
        tasks = session.exec(select(IELTSWritingTaskRecord).where(IELTSWritingTaskRecord.test_id == t.id).order_by(IELTSWritingTaskRecord.task_number)).all()
        result.append({
            "material": {"id": f"test_{t.id}", "db_id": t.id, "type": "writing", "topic": t.topic or "Writing Test"},
            "tasks": [{"questions": {"parts": [{"part": tsk.task_number, "title": getattr(tsk, "title", f"Task {tsk.task_number}"), "transcript_segment": getattr(tsk, "transcript_segment", ""), "brief_content": tsk.brief_content, "user_submission": tsk.user_submission, "correction_feedback": tsk.correction_feedback, "db_task_id": tsk.id} for tsk in tasks]}}]
        })
        
    for j in journals:
        result.append({
            "material": {"id": f"journal_{j.id}", "db_id": j.id, "type": "daily_journal", "topic": j.topic or "Daily Journal"},
            "tasks": [{"questions": {"parts": [{"part": 1, "title": "Journal Entry", "transcript_segment": "Free writing", "brief_content": "Free Writing", "user_submission": j.user_submission, "correction_feedback": j.correction_feedback}]}}]
        })
    return result

@router.delete("/writing/{item_id}", status_code=204)
async def delete_writing(
    item_id: str, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if item_id.startswith("test_"):
        db_id = int(item_id.split("_")[1])
        test = session.get(IELTSWritingTest, db_id)
        if test:
            tasks = session.exec(select(IELTSWritingTaskRecord).where(IELTSWritingTaskRecord.test_id == db_id)).all()
            for t in tasks: session.delete(t)
            session.delete(test)
    elif item_id.startswith("journal_"):
        db_id = int(item_id.split("_")[1])
        journal = session.get(DailyJournal, db_id)
        if journal: session.delete(journal)
        
    session.commit()

@router.post("/writing/generate", status_code=201)
async def api_generate_writing_test(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    generated = await generate_writing_test()
    test = IELTSWritingTest(topic=generated.get("topic", "Writing Test"), user_id=current_user.id)
    session.add(test)
    session.commit()
    session.refresh(test)
    for p in generated.get("parts", []):
        task = IELTSWritingTaskRecord(
            test_id=test.id,
            task_number=p.get("part", 1),
            title=p.get("title", f"Task {p.get('part', 1)}"),
            brief_content=p.get("brief", ""),
            transcript_segment=p.get("transcript_segment", ""),
            user_submission="",
        )
        session.add(task)
    session.commit()
    return {"status": "success"}

@router.post("/speaking/generate", status_code=201)
async def api_generate_speaking_test(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    generated = await generate_speaking_test()
    test = IELTSSpeakingTest(topic=generated.get("topic", "Speaking Test"), user_id=current_user.id)
    session.add(test)
    session.commit()
    session.refresh(test)
    for p in generated.get("parts", []):
        part = IELTSSpeakingPartRecord(
            test_id=test.id,
            part_number=p.get("part", 1),
            title=p.get("title", f"Part {p.get('part', 1)}"),
            brief_content=p.get("brief", ""),
            transcript_segment=p.get("transcript_segment", ""),
            user_audio_url="",
        )
        session.add(part)
    session.commit()
    return {"status": "success"}
@router.post("/speaking/transcribe")
async def api_transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Accept audio file, transcribe via Whisper, return text.
    """
    try:
        audio_bytes = await file.read()
        text = transcribe_audio(audio_bytes, file.filename, file.content_type)
        return {"text": text}
    except Exception as e:
        logger.error("Transcription failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/speaking/{part_id}/submit", status_code=200)
async def submit_speaking(
    part_id: int, 
    req: SubmitWritingRequest, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    evaluation = await evaluate_writing_task(req.user_submission, req.brief_content)
    part = session.get(IELTSSpeakingPartRecord, part_id)
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
        
    part.user_audio_url = req.user_submission[:100]
    part.correction_feedback = evaluation
    session.add(part)
    session.commit()
    
    test_parent = session.get(IELTSSpeakingTest, part.test_id)
    return {
        "material": {"id": part.test_id, "type": "speaking", "topic": getattr(test_parent, "topic", "Speaking Test")},
        "tasks": [{"questions": {"parts": [{"part": part.part_number, "title": getattr(part, "title", f"Part {part.part_number}"), "transcript_segment": getattr(part, "transcript_segment", ""), "brief_content": part.brief_content, "user_audio_url": part.user_audio_url, "correction_feedback": part.correction_feedback, "db_task_id": part.id}]}}]
    }

@router.get("/speaking")
async def list_speaking(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    tests = session.exec(
        select(IELTSSpeakingTest)
        .where(IELTSSpeakingTest.user_id == current_user.id)
        .order_by(IELTSSpeakingTest.created_at.desc())
        .limit(30)
    ).all()
    result = []
    for t in tests:
        parts = session.exec(select(IELTSSpeakingPartRecord).where(IELTSSpeakingPartRecord.test_id == t.id).order_by(IELTSSpeakingPartRecord.part_number)).all()
        result.append({
            "material": {"id": t.id, "type": "speaking", "topic": t.topic or "Speaking Test"},
            "tasks": [{"questions": {"parts": [{"part": p.part_number, "title": getattr(p, "title", f"Part {p.part_number}"), "transcript_segment": getattr(p, "transcript_segment", ""), "brief_content": p.brief_content, "user_audio_url": p.user_audio_url, "correction_feedback": p.correction_feedback, "db_task_id": p.id} for p in parts]}}]
        })
    return result

@router.delete("/speaking/{test_id}", status_code=204)
async def delete_speaking(
    test_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    test = session.get(IELTSSpeakingTest, test_id)
    if test:
        parts = session.exec(select(IELTSSpeakingPartRecord).where(IELTSSpeakingPartRecord.test_id == test_id)).all()
        for p in parts: session.delete(p)
        session.delete(test)
        session.commit()
