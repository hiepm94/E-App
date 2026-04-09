"""
app/services/llm.py
─────────────────────────────────────────────────────────────────────────────
Async native LLM gateway.
Routes between Groq and NVIDIA using raw HTTPX client.
All prompt templates live in app/services/prompts.py
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings
from app.services import prompts

logger = logging.getLogger(__name__)

# ── Security: prompt injection guard ──────────────────────────────────────
_INJECTION_PATTERNS = re.compile(
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?|"
    r"you\s+are\s+now|forget\s+(everything|all)|"
    r"act\s+as|system\s+prompt|jailbreak",
    re.IGNORECASE,
)

def sanitize_user_input(text: str) -> str:
    text = text.replace("<", "﹤").replace(">", "﹥")
    return _INJECTION_PATTERNS.sub("[REDACTED]", text).strip()

def repair_json(json_str: str) -> str:
    """Attempt to close truncated JSON structures (auto-unclosed quotes/braces)."""
    json_str = json_str.strip()
    if not json_str: return "{}"
    
    # 1. Handle unclosed quotes and find nesting
    stack = []
    in_string = False
    escaped = False
    fixed_str = ""
    
    for i, char in enumerate(json_str):
        if escaped:
            fixed_str += char
            escaped = False
            continue
        
        if char == '\\':
            fixed_str += char
            escaped = True
            continue
            
        if char == '"':
            in_string = not in_string
            fixed_str += char
            continue
            
        fixed_str += char
        if not in_string:
            if char == '{': stack.append('}')
            elif char == '[': stack.append(']')
            elif char == '}': 
                if stack and stack[-1] == '}': stack.pop()
            elif char == ']':
                if stack and stack[-1] == ']': stack.pop()
                
    # 2. If we're still in a string, close it
    if in_string:
        if fixed_str.endswith('\\'): fixed_str = fixed_str[:-1]
        fixed_str += '"'
        
    # 3. Handle trailing commas before closing
    # e.g. '{"a": 1,' -> '{"a": 1'
    fixed_str = fixed_str.strip()
    while fixed_str.endswith(','):
        fixed_str = fixed_str[:-1].strip()
        
    # 4. Close remaining structures
    res = fixed_str + "".join(reversed(stack))
    return res

def clean_json(raw: str) -> Any:
    """Extract and parse JSON from LLM response strings, handling markdown, noise, and truncation."""
    text = raw.strip()
    
    # 1. Try markdown code block extraction first
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    
    # 2. Find the very first JSON structural token ({  or [)
    #    This strips any conversational noise before the JSON starts
    first_brace = text.find('{')
    first_bracket = text.find('[')
    
    if first_brace == -1 and first_bracket == -1:
        raise ValueError("No JSON structure found in LLM response")
    
    if first_brace == -1:
        start_idx = first_bracket
    elif first_bracket == -1:
        start_idx = first_brace
    else:
        start_idx = min(first_brace, first_bracket)
    
    # Take everything from the first structural token onward (may be truncated)
    text = text[start_idx:].strip()

    # 3. Try direct parse first (no repair needed if response is well-formed)
    try:
        return json.loads(text, strict=False)
    except json.JSONDecodeError:
        pass

    # 4. Fix common issues: unescaped newlines inside string values
    def fix_newlines(m):
        return m.group(0).replace('\n', '\\n')
    text_fixed = re.sub(r'":\s*"([^"]*)"', fix_newlines, text)
    try:
        return json.loads(text_fixed, strict=False)
    except json.JSONDecodeError:
        pass

    # 5. Final fallback: pass to repair_json to close truncated structures
    try:
        repaired = repair_json(text_fixed)
        return json.loads(repaired, strict=False)
    except Exception as final_e:
        logger.error("JSON parse failed. Raw snippet: %s", raw[:500])
        raise final_e


# ── Native Sync LLM Routing ─────────────────────────────────────────────

def _call_groq(prompt: str, temperature: float = 0.3) -> str:
    if not settings.GROQ_API_KEY:
        raise ValueError("No Groq key available")
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": 8192,
        "response_format": {"type": "json_object"}
    }
    with httpx.Client(timeout=90.0) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


def _call_nvidia(prompt: str, temperature: float = 0.3) -> str:
    """Robust NVIDIA NIM call (Mistral Large 2) with extended timeout and retries."""
    if not settings.NVIDIA_API_KEY:
        raise ValueError("No NVIDIA key available")
        
    if not settings.NVIDIA_API_KEY.startswith("nvapi-"):
        raise ValueError("Invalid NVIDIA_API_KEY format (expected 'nvapi-')")

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta/llama-3.1-70b-instruct",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": 8192
    }
    
    # 2-attempt retry logic with 120s timeout (Mistral is normally <1s)
    for attempt in range(2):
        try:
            with httpx.Client(timeout=150.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning("NVIDIA attempt %d failed: %s", attempt + 1, e)
            if attempt == 1: raise e


def _complete(prompt: str, temperature: float = 0.3) -> str:
    """Try Groq first, if it fails try NVIDIA."""
    errs = []
    
    # Preferred: Groq
    if settings.GROQ_API_KEY:
        try:
            return _call_groq(prompt, temperature=temperature)
        except Exception as e:
            logger.warning("Groq primary failed: %s", e)
            errs.append(f"Groq: {str(e)}")

    # Fallback: NVIDIA
    if settings.NVIDIA_API_KEY:
        try:
            return _call_nvidia(prompt, temperature=temperature)
        except Exception as e:
            logger.warning("NVIDIA fallback failed: %s", e)
            errs.append(f"NVIDIA: {str(e)}")
            
    if not settings.GROQ_API_KEY and not settings.NVIDIA_API_KEY:
         raise RuntimeError("No valid LLM keys configured (Groq/NVIDIA).")
         
    raise RuntimeError(f"All LLM engines failed. Errors: {errs}")


# ── Public sync service functions ────────────────────────────────────────

def generate_vocab_expansion(word: str, original_context: str = "") -> dict:
    word = sanitize_user_input(word[: settings.MAX_WORD_LENGTH])
    original_context = sanitize_user_input(original_context[: settings.MAX_CONTEXT_LENGTH])

    prompt = prompts.vocab_expansion(word, original_context)
    try:
        return clean_json(_complete(prompt))
    except Exception as e:
        logger.warning("Vocab LLM parse failed for word: %s. Error: %s", word, e, exc_info=True)
        return {"pronunciation": "", "synonyms": [], "collocations": [], "example_sentences": []}

def generate_parrot_expansion(sentence: str) -> dict:
    sentence = sanitize_user_input(sentence[: settings.MAX_RAW_TASK_LENGTH])
    prompt = prompts.parrot_expansion(sentence)
    try:
        return clean_json(_complete(prompt))
    except Exception as e:
        logger.warning("Parrot parse failed for sentence: %s. Error: %s", sentence, e, exc_info=True)
        return {"tags": ["unclassified"], "explanation": "Failed to generate context."}

def generate_random_parrot_content() -> dict:
    prompt = prompts.generate_random_parrot()
    try:
        # We use a higher temperature (0.9) to ensure randomness and variety for the "Inspiration Parrot"
        data = clean_json(_complete(prompt, temperature=0.9))
        # Ensure we always return the sentence key
        if "sentence" not in data and "sentences" in data and len(data["sentences"]) > 0:
            data["sentence"] = data["sentences"][0]
        return data
    except Exception as e:
        logger.warning("Random parrot generation failed. Error: %s", e, exc_info=True)
        return {"sentence": "The quick brown fox jumps over the lazy dog."}


def extract_ielts_task(raw_text: str, task_type: str, raw_exercises_text: str = "") -> dict:
    raw_text = sanitize_user_input(raw_text[: settings.MAX_RAW_TASK_LENGTH])
    task_type = task_type[:20]
    raw_exercises_text = sanitize_user_input(raw_exercises_text[: settings.MAX_RAW_TASK_LENGTH])

    prompt = prompts.ielts_task_extraction(raw_text, task_type, raw_exercises_text)
    try:
        return clean_json(_complete(prompt))
    except Exception as e:
        logger.warning("IELTS task parse failed. Error: %s", e, exc_info=True)
        return {"parts": []}


def generate_part_exercises(transcript_segment: str, task_type: str, part_num: int = 1) -> dict:
    prompt = prompts.generate_part_exercises(transcript_segment, task_type, part_num)
    try:
        return clean_json(_complete(prompt))
    except Exception as e:
        logger.warning("Part exercise generation failed. Error: %s", e)
        return {"questions": []}

def generate_random_ielts_material(task_type: str) -> dict:
    prompt = prompts.generate_random_material(task_type)
    try:
        return clean_json(_complete(prompt))
    except Exception as e:
        logger.warning("Random material generation failed. Error: %s", e, exc_info=True)
        return {"topic": "Failed", "transcript": "Could not generate."}




def evaluate_writing_task(user_text: str, brief: str = "") -> dict:
    user_text = sanitize_user_input(user_text[: settings.MAX_SUBMISSION_LENGTH])
    brief = sanitize_user_input(brief[: settings.MAX_CONTEXT_LENGTH])

    prompt = prompts.writing_evaluation(user_text, brief)
    try:
        return clean_json(_complete(prompt))
    except Exception as e:
        logger.warning("Writing evaluation parse failed. Error: %s", e, exc_info=True)
        return {
            "score": "N/A",
            "feedback": "Could not parse LLM response.",
            "enhanced_version": "",
            "grammar_tips": [],
            "vocab_tips": [],
        }

def generate_writing_test() -> dict:
    try:
        return clean_json(_complete(prompts.create_writing_test()))
    except Exception as e:
        logger.warning("Brief generation failed: %s", e)
        return {"parts": []}

def generate_speaking_test() -> dict:
    try:
        return clean_json(_complete(prompts.create_speaking_test()))
    except Exception as e:
        logger.warning("Brief generation failed: %s", e)
        return {"parts": []}


# ── Audio Transcription (Whisper) ──────────────────────────────────────────

def transcribe_audio(audio_bytes: bytes, filename: str, content_type: str = "audio/mpeg") -> str:
    """
    Send audio file to Groq's Whisper endpoint.
    Returns the transcribed text.
    """
    if not settings.GROQ_API_KEY:
        raise ValueError("No Groq key available for transcription")

    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    files = {"file": (filename, audio_bytes, content_type)}
    data = {"model": "whisper-large-v3", "response_format": "json"}

    with httpx.Client(timeout=60.0) as client:
        response = client.post(url, headers=headers, files=files, data=data)
        response.raise_for_status()
        return response.json().get("text", "")

