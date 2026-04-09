"""
app/services/prompts.py
─────────────────────────────────────────────────────────────────────────────
All LLM prompt templates live here. Edit this file to tune AI behaviour
without touching any service or routing logic.

Each function returns a fully-formed prompt string ready to be sent as a
"user" message to the LLM. System-level framing is embedded inside each
prompt so it works with both system-prompt-aware and basic models.
"""
from __future__ import annotations


def vocab_expansion(word: str, context: str) -> str:
    """
    Ask the LLM to produce pronunciation, synonyms and collocations
    for a vocabulary word, optionally anchored to a real sentence context.
    """
    context_clause = (
        f' found in this context: "<user_input>{context}</user_input>".'
        if context
        else "."
    )
    return f"""You are an expert English IELTS tutor.
Analyze the vocabulary word '{word}'{context_clause}

Return ONLY a valid JSON object — no markdown, no explanation — with exactly:
{{"pronunciation": "<IPA string>", "synonyms": ["<word1>", "<word2>", "<word3>"], "collocations": ["<phrase1>", "<phrase2>"], "example_sentences": ["<sentence1>", "<sentence2>", "<sentence3>"]}}"""


def parrot_expansion(sentence: str) -> str:
    """
    Generate meaningful tags and linguistic context for a given phrase, sentence, or idiom.
    Now explicitly includes grammar explanation and natural usage.
    """
    return f"""You are an expert linguistic analyst and IELTS tutor.
Analyze the following sentence or phrase provided by the user:
<user_input>{sentence}</user_input>

Categorize the phrase, selecting EXACTLY 2-4 appropriate tags (e.g., 'grammar', 'spoken', 'idiom', 'question', 'formal', 'slang', 'colloquial').
Provide a clear, rich explanation of the phrase's meaning. 
CRITICAL: You MUST include a specific section on the GRAMMAR used (tenses, structures, patterns) and natural tips on when/how to use this in a conversation.

Return ONLY a valid JSON object — no markdown, no explanation — with exactly:
{{"tags": ["<tag1>", "<tag2>"], "explanation": "<Your clear, multi-sentence contextual explanation including a deep dive into grammar and usage tips>"}}"""


def generate_random_parrot() -> str:
    """
    Generate a high-quality, interesting English sentence or conversation snippet for a student to study.
    """
    return """You are a creative English language curator. 
Your goal is to provide a unique, high-quality, and interesting English sentence, idiom, or conversation snippet.

To ensure variety, choose one of the following 'vibes' randomly for each generation:
1. 'Street Slang': A natural, modern colloquialism or slang phrase used in the UK/USA.
2. 'Poetic/Philosophic': A beautiful, thought-provoking, or literary sentence.
3. 'Business Professional': A sophisticated corporate or professional expression.
4. 'Academic/Complex': A sentence with advanced grammar (e.g., inversion, mixed conditionals).
5. 'Casual Conversation': A snippet of a realistic, natural dialog between friends.
6. 'Idiomatic': A colorful English idiom with its natural context.

Avoid generic examples like "The quick brown fox" or "Hello, how are you?". 
Variety is absolutely mandatory. Surprise the student with something they won't find in a standard textbook.

Return ONLY a valid JSON object — no markdown — with exactly:
{"sentence": "<The interesting English phrase or conversation snippet>"}"""


def ielts_task_extraction(raw_text: str, task_type: str, raw_exercises_text: str = "") -> str:
    """
    Generate or parse IELTS questions conforming to the true IELTS Academic formats.
    """
    if task_type.lower() == "reading":
        question_types = "True/False/Not Given, Yes/No/Not Given, Matching headings, Matching information, Matching features, Sentence completion, Summary completion, Note/table/diagram completion, Multiple choice, Short-answer questions"
        structure_note = "Group exactly 3 passages into consecutive objects within a 'parts' array."
        audio_clause = ""
    else:
        question_types = "Form/table/note completion, Multiple choice, Map/plan labelling, Matching, Sentence/summary completion"
        structure_note = "Group exactly 4 sections into consecutive objects within a 'parts' array."
        audio_clause = 'If a Google Drive or audio link is present in the text for a given part, place it in the "drive_audio_url" key, otherwise null.'

    exercise_directive = (
        f"The user has provided MANUAL exercises text:\n<exercises>\n{raw_exercises_text}\n</exercises>\n"
        f"Carefully parse exactly these user-provided questions into the target JSON structure."
    ) if raw_exercises_text else (
        f"Create brand new authentic IELTS-standard questions based on the text. Include clear instructions."
    )

    return f"""You are an experienced IELTS exam designer.
Task type: {task_type.upper()}

Source material transcript (may contain multiple passages or parts and embedded links):
<user_input>{raw_text}</user_input>

Instructions:
- {exercise_directive}
- CRITICAL STRUCTURE: 
  * If LISTENING: You MUST provide EXACTLY 4 sections (Parts 1, 2, 3, and 4).
  * If READING: You MUST provide EXACTLY 3 passages (Passages 1, 2, and 3).
- CRITICAL CONTENT: For EACH part, you MUST copy the EXACT VERBATIM paragraph(s) from the source material into "transcript_segment". DO NOT summarize.
- VOLUME: Provide EXACTLY 10 questions per part (Listening) or 13-14 questions per passage (Reading).
- Use legitimate IELTS question types: {question_types}.
{audio_clause}

OUTPUT RULE: Return ONLY a valid JSON object. No markdown, no conversational filler, no explanations. If you cannot fulfill the request perfectly, return an empty "parts" array like: {{"parts": []}}.

Return ONLY valid JSON in this exact shape:
{{
  "parts": [
    {{
      "part": 1,
      "title": "...",
      "transcript_segment": "...",
      "drive_audio_url": "...",
      "questions": [
        {{"question": "...", "type": "multiple_choice", "options": ["A","B","C","D"], "answer": "..."}},
        {{"question": "Fill in the blank: The ___ was fast.", "type": "fill_in_the_blank", "answer": "car"}},
        ... (at least 10 items total)
      ]
    }}
  ]
}}"""


def generate_part_exercises(transcript_segment: str, task_type: str, part_num: int = 1) -> str:
    """
    Focused prompt for generating 3-5 high-quality IELTS questions for a specific segment.
    Targets official question types based on the part number.
    """
    if task_type == "reading":
        question_types = "True/False/Not Given, Yes/No/Not Given, Matching headings, Sentence completion, Multiple choice"
    else:
        # Listening Breakdown
        if part_num == 1:
            question_types = "Form completion, Table completion, Note completion (transactional context)"
        elif part_num == 2:
            question_types = "Multiple choice, map/plan labelling, matching (one speaker)"
        elif part_num == 3:
            question_types = "Multiple choice, matching (academic discussion/multiple speakers)"
        else:
            question_types = "Note/summary completion, sentence completion (academic lecture/dense vocabulary)"
    
    return f"""You are an elite IELTS exam designer. 
Generate a set of 3 to 5 authentic IELTS-standard questions for the following text (Task: {task_type.upper()}, Part/Passage: {part_num}):

<text_segment>
{transcript_segment}
</text_segment>

Instructions:
- Use these question types: {question_types}.
- Ensure the questions match the specific difficulty and style of Part {part_num} of the IELTS Academic test.
- Provide clear instructions for each question group.

Return ONLY valid JSON — no markdown — in this exact shape:
{{
  "questions": [
    {{"question": "...", "type": "multiple_choice", "options": ["A","B","C","D"], "answer": "..."}},
    {{"question": "Fill in the blank (max 2 words): The concept of ___ is vital.", "type": "fill_in_the_blank", "answer": "sustainability"}},
    {{"question": "The writer believes technology is harmful. (True/False/Not Given)", "type": "true_false", "answer": "True"}}
  ]
}}"""


def generate_random_material(task_type: str) -> str:
    """
    Generate a full test record obeying realistic IELTS Academic lengths and contexts.
    """
    if task_type.lower() == "reading":
        format_rules = """Generate a FULL Reading Test. You must provide exactly 3 passages.
- Passage 1: Descriptive/Factual
- Passage 2: Discursive/Analytical
- Passage 3: Extended Argument/Abstract"""
    else:
        format_rules = """Generate a FULL Listening Test. You must provide exactly 4 parts/sections.
- Part 1: Social/Everyday Conversation
- Part 2: Monologue (Non-academic)
- Part 3: Discussion (Educational)
- Part 4: Monologue (Academic Lecture)"""

    return f"""You are a Cambridge IELTS material writer.
Create a brand new, realistic full-scale IELTS {task_type.upper()} material record.
{format_rules}

OUTPUT RULE: Return ONLY a valid JSON object. No markdown, no chatter. 
Structure:
- "topic": A unique, academic-sounding name.
- "transcript": The complete text spanning all parts. Use "## Part 1", "## Part 2", etc. as headers within this string to separate sections.

Return ONLY a valid JSON object with exactly:
{{"topic": "<Overall Test Name>", "transcript": "<The complete text spanning all parts, clearly segmented>"}}"""


def writing_evaluation(user_text: str, brief: str) -> str:
    """
    Ask the LLM to grade a student's writing or speaking submission against official IELTS criteria.
    """
    brief_line = f'Task/Brief: "{brief}"' if brief else "Task: Free journal entry (no specific brief)."
    return f"""You are a certified IELTS examiner grading according to official band descriptors (0-9).
{brief_line}

Student submission:
<user_input>{user_text}</user_input>

Evaluate the submission on the four official criteria:
For Writing: Task Achievement / Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy.
For Speaking (evaluating transcript): Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation (inferred from transcript structure).
For journal entries, focus on naturalness and improvement without a band score.

Return ONLY a valid JSON object — no markdown, no conversational text — with exactly these keys:
{{"score": "<Overall Band Score (e.g. 6.5 or N/A)>", "enhanced_version": "<A rewritten Band 9.0 version of the student's submission that improves their grammar, vocabulary, and flow while keeping the same core meaning>", "feedback": "<Overall comment assessing the 4 criteria>", "grammar_tips": ["<tip1>", "<tip2>", "<tip3>"], "vocab_tips": ["<tip1>", "<tip2>", "<tip3>"]}}"""


def create_writing_test() -> str:
    return """You are a Cambridge IELTS exam generator.
Generate a FULL IELTS Writing Test consisting of two parts:
- Task 1: Describe data/trends from a fictional table, chart, or diagram (min 150 words).
- Task 2: Discursive Essay - Opinion, Discussion, Problem/Solution, or direct questions (min 250 words).

Return ONLY a valid JSON object — no markdown — with exactly:
{
 "topic": "<A unique, descriptive name for this specific test (e.g. 'Writing Test - Renewable Energy & Urban Growth')>",
 "parts": [
  {
    "part": 1, 
    "title": "Task 1",
    "brief": "<The full prompt text for Task 1>",
    "transcript_segment": "<A high-scoring Band 9.0 model answer for Task 1 to help students study vocabulary and structure>"
  }, 
  {
    "part": 2, 
    "title": "Task 2",
    "brief": "<The full prompt text for Task 2>",
    "transcript_segment": "<A high-scoring Band 9.0 model answer for Task 2 to help students study vocabulary and structure>"
  }
]}"""

def create_speaking_test() -> str:
    return """You are an IELTS exam generator.
Generate a full, complete IELTS Speaking Test prompt encompassing all three parts:
- Part 1 (Introduction & Interview): 3-4 questions on familiar personal topics.
- Part 2 (Individual Long Turn): A cue card topic with 3-4 bullet-point prompts.
- Part 3 (Two-way Discussion): 3-4 abstract, thematic questions linked to Part 2.

Return ONLY a valid JSON object — no markdown — with exactly:
{
 "topic": "<A unique, descriptive name for this specific test (e.g. 'Speaking Test - Travel & Environment')>",
 "parts": [
  {
    "part": 1, 
    "title": "Part 1 - Introduction",
    "brief": "<Formatted questions for Part 1>",
    "transcript_segment": "<A model transcript of a Band 9.0 candidate response to these questions>"
  }, 
  {
    "part": 2, 
    "title": "Part 2 - Cue Card",
    "brief": "<Cue card topic and bullet points for Part 2>",
    "transcript_segment": "<A model transcript of a Band 9.0 candidate continuous talk for Part 2>"
  }, 
  {
    "part": 3, 
    "title": "Part 3 - Discussion",
    "brief": "<Questions for Part 3>",
    "transcript_segment": "<A model transcript of a Band 9.0 candidate and examiner discussion for Part 3>"
  }
]}"""


