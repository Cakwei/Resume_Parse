import os
import json
import asyncio
from typing import Optional, AsyncGenerator
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from schemas.resume import ATSScoreBreakdown, CandidateProfile

current_dir = Path(__file__).resolve().parent
env_path = current_dir.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or os.getenv("OPENROUTER_API_KEY", "")
)

MAX_RESUME_CHARS = 30000

def _truncate_text(text: str, max_chars: int = MAX_RESUME_CHARS) -> str:
    if len(text) > max_chars:
        return text[:max_chars] + "\n\n... [Resume text truncated for ATS evaluation context safety]"
    return text

def build_audit_prompt(resume_text: str, job_description: Optional[str] = None) -> str:
    safe_resume = _truncate_text(resume_text)
    jd_context = ""
    if job_description and job_description.strip():
        jd_context = f"""
        [TARGET JOB DESCRIPTION PROVIDED]
        The candidate is specifically targeting this role:
        \"\"\"{job_description.strip()}\"\"\"

        In addition to general ATS parseability, thoroughly evaluate how well the resume matches this target job description:
        - Analyze keyword alignment and hard/soft skill gaps.
        - Highlight missing qualifications or technologies specifically mentioned in the job description.
        """
    else:
        jd_context = """
        [NO TARGET JOB DESCRIPTION PROVIDED]
        Evaluate this resume against universal industry standards, modern technical recruiter expectations, and standard ATS benchmarks.
        """

    return f"""
Act as an expert ATS (Applicant Tracking System) scanner, technical recruiter, and executive resume writer with 15+ years of experience.

I want you to analyze my current resume based on industry-standard ATS-friendliness, modern hiring guidelines, and recruitment best practices. Do not fabricate or invent any new work experiences, job titles, or metrics—strictly use the factual background provided.

{jd_context}

Here is the extracted resume text:
\"\"\"{safe_resume}\"\"\"

Please provide your output in the following clear sections:
## 1. ATS Compliance Rating & Scorecard
- Estimated Overall ATS Score (0-100%) and brief executive rationale.
- Parseability Rating, Keyword Density, and Formatting Safety.
- If a Target Job Description was provided, state the Role Match Score (0-100%) and identify Top Matched Skills vs. Missing Skills.

## 2. Structural & Formatting Flaws
- Detail elements that will break or confuse ATS scanners (e.g. multi-column layouts, tables, headers/footers, special characters, non-standard section titles).
- Check for standard expected sections (Summary, Experience, Education, Skills).

## 3. Bullet Point & Metrics Audit
- Point out vague bullets, passive phrasing, and missing quantifiable outcomes (KPIs, percentages, dollar figures).
- Highlight weak action verbs and list stronger replacements.

## 4. Optimized Rewrites (Google X-Y-Z Formula)
- Rewrite the professional summary and key work experience bullet points to maximize impact using the formula: "Accomplished [X] as measured by [Y], by doing [Z]".
- Strictly adhere to factual background provided without inventing unmentioned employers or degrees.

[SYSTEM INSTRUCTION: MARKDOWN FORMATTING RULES]
1. Use standard GitHub Flavored Markdown (GFM).
2. Use clear headings starting with "## ".
3. Separate sections and bullet points with double newlines to avoid text collapsing.
4. Use standard markdown tables with header divider rows when presenting comparisons.
"""

def build_schema_prompt(resume_text: str, job_description: Optional[str] = None) -> str:
    safe_resume = _truncate_text(resume_text)
    jd_instruction = ""
    if job_description and job_description.strip():
        jd_instruction = f"""
        [TARGET JOB DESCRIPTION]
        \"\"\"{job_description.strip()}\"\"\"
        Compare candidate skills with the target job description to compute:
        - `role_match_score` (0-100 integer)
        - `matched_skills` (list of matching skills found in the resume)
        - `missing_skills` (list of key required skills missing from the resume)
        """
    else:
        jd_instruction = """
        [NO TARGET JOB DESCRIPTION]
        - Set `role_match_score` to null.
        - Set `matched_skills` to the candidate's top identified strengths.
        - Set `missing_skills` to standard industry-expected skills for this domain that would improve the profile.
        """

    return f"""
You are a precise data extraction and ATS scoring engine. Extract the candidate's resume information and compute ATS score metrics into structured data matching the specified schema.

{jd_instruction}

Resume text:
\"\"\"{safe_resume}\"\"\"
"""

async def generate_ats_stream(resume_text: str, job_description: Optional[str] = None) -> AsyncGenerator[str, None]:
    """
    Dual-worker streaming generator using Google Gemini API (`gemini-3.8-flash`):
    1. Worker 1 streams real-time Markdown audit critique to the user via SSE.
    2. Worker 2 concurrently executes structured Pydantic schema extraction (`ATSScoreBreakdown`).
    3. Emits `data: [STRUCTURED_JSON] {...}` once Worker 2 finishes.
    """
    client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else genai.Client()

    audit_prompt = build_audit_prompt(resume_text, job_description)
    schema_prompt = build_schema_prompt(resume_text, job_description)

    # Worker 2: Structured JSON extraction using Gemini native response_schema
    async def extract_structured_json():
        try:
            res = await client.aio.models.generate_content(
                model="gemini-3.8-flash",
                contents=schema_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ATSScoreBreakdown,
                ),
            )

            if hasattr(res, "parsed") and res.parsed:
                if isinstance(res.parsed, ATSScoreBreakdown):
                    return res.parsed.model_dump_json()
                return ATSScoreBreakdown.model_validate(res.parsed).model_dump_json()

            raw_text = res.text or "{}"
            validated = ATSScoreBreakdown.model_validate_json(raw_text)
            return validated.model_dump_json()

        except Exception as e:
            # Fallback baseline data if extraction encounters issues
            fallback = ATSScoreBreakdown(
                overall_score=75,
                parseability=80,
                keyword_relevance=75,
                formatting_safety=80,
                metric_impact=70,
                role_match_score=70 if job_description else None,
                matched_skills=[],
                missing_skills=[],
                profile=CandidateProfile(summary=f"Parsed from resume. Notice: {str(e)[:100]}")
            )
            return fallback.model_dump_json()

    json_task = asyncio.create_task(extract_structured_json())

    # Worker 1: Streaming Markdown Audit
    try:
        response_stream = await client.aio.models.generate_content_stream(
            model="gemini-3.8-flash",
            contents=audit_prompt,
        )

        async for chunk in response_stream:
            if chunk.text:
                safe_content = chunk.text.replace("\n", "\\n")
                yield f"data: {safe_content}\n\n"

    except Exception as stream_err:
        yield f"data: Error during audit streaming: {str(stream_err)}\n\n"

    # Await Worker 2 structured JSON and emit event
    try:
        structured_json_str = await json_task
        yield f"data: [STRUCTURED_JSON] {structured_json_str}\n\n"
    except Exception as json_err:
        yield f"data: [STRUCTURED_JSON] {json.dumps({'error': str(json_err)})}\n\n"
