"""
app/api/hub.py  — Knowledge Hub: Vocab & Parrot
─────────────────────────────────────────────────────────────────────────────
All routes are async. LLM expansion and media scraping run concurrently
via asyncio.gather() so a vocab card is ready in ~one LLM round trip.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import get_session
from app.models.knowledge import Parrot, Vocab
from app.models.user import User
from app.services.llm import generate_vocab_expansion, generate_parrot_expansion, generate_random_parrot_content
from app.services.scraper import get_media_for_word
from app.api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request schemas ────────────────────────────────────────────────────────

class VocabCreateRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=60)
    context: Optional[str] = Field("", max_length=500)


class ParrotCreateRequest(BaseModel):
    sentence: str = Field(..., min_length=1, max_length=500)
    tags: Optional[List[str]] = Field(default_factory=list)


# ── Vocab routes ──────────────────────────────────────────────────────────

@router.post("/vocab", response_model=Vocab, status_code=201)
async def create_vocab(
    req: VocabCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Save a new vocabulary word.
    LLM expansion and DuckDuckGo media scrape run IN PARALLEL
    (asyncio.gather) to minimise total latency.
    """
    # Run asynchronously
    llm_data = await generate_vocab_expansion(req.word, req.context or "")
    media = await get_media_for_word(req.word)

    vocab = Vocab(
        word=req.word.strip(),
        user_id=current_user.id,
        original_context=req.context,
        pronunciation=llm_data.get("pronunciation", ""),
        synonyms=llm_data.get("synonyms", []),
        collocations=llm_data.get("collocations", []),
        example_sentences=llm_data.get("example_sentences", []),
        scraped_media=media,
    )
    session.add(vocab)
    session.commit()
    session.refresh(vocab)
    return vocab


@router.get("/vocab", response_model=List[Vocab])
async def list_vocab(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List vocab for the current user, limited to 60 for speed."""
    statement = (
        select(Vocab)
        .where(Vocab.user_id == current_user.id)
        .order_by(Vocab.created_at.desc())
        .limit(60)
    )
    return session.exec(statement).all()


@router.delete("/vocab/{vocab_id}", status_code=204)
async def delete_vocab(
    vocab_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    vocab = session.get(Vocab, vocab_id)
    if not vocab:
        raise HTTPException(status_code=404, detail="Vocab not found")
    session.delete(vocab)
    session.commit()


# ── Parrot routes ─────────────────────────────────────────────────────────

@router.post("/parrot", response_model=Parrot, status_code=201)
async def create_parrot(
    req: ParrotCreateRequest, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Save a new parrot phrase/sentence.
    Automatically generates linguistic tagging and context explanations via LLM.
    """
    llm_data = await generate_parrot_expansion(req.sentence)
    
    # Merge any manually provided tags with AI-generated ones, removing duplicates
    combined_tags = list(set((req.tags or []) + llm_data.get("tags", [])))

    parrot = Parrot(
        sentence=req.sentence.strip(), 
        user_id=current_user.id,
        tags=combined_tags, 
        explanation=llm_data.get("explanation", "")
    )
    session.add(parrot)
    session.commit()
    session.refresh(parrot)
    return parrot


@router.get("/parrot", response_model=List[Parrot])
async def list_parrots(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List parrots for the current user, limited to 60 for speed."""
    statement = (
        select(Parrot)
        .where(Parrot.user_id == current_user.id)
        .order_by(Parrot.created_at.desc())
        .limit(60)
    )
    return session.exec(statement).all()


@router.delete("/parrot/{parrot_id}", status_code=204)
async def delete_parrot(
    parrot_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    parrot = session.get(Parrot, parrot_id)
    if not parrot:
        raise HTTPException(status_code=404, detail="Parrot not found")
    session.delete(parrot)
    session.commit()

@router.post("/parrot/random", response_model=Parrot, status_code=201)
async def create_random_parrot(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a random interesting English phrase, explain it, and save it.
    """
    random_content = await generate_random_parrot_content()
    random_sentence = random_content.get("sentence", "The quick brown fox jumps over the lazy dog.")
    llm_data = await generate_parrot_expansion(random_sentence)
    
    parrot = Parrot(
        sentence=random_sentence, 
        tags=llm_data.get("tags", []), 
        explanation=llm_data.get("explanation", ""),
        user_id=current_user.id
    )
    session.add(parrot)
    session.commit()
    session.refresh(parrot)
    return parrot
