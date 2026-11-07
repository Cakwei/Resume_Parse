# ATS Resume Intelligence & Hybrid Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the resume parser into a high-speed, dual-engine ATS intelligence platform featuring hybrid document ingestion (PyMuPDF + VLM fallback), structured Pydantic JSON extraction, optional Job Description skill matching, and an interactive multi-tab dashboard with visual ATS score gauges.

**Architecture:** The FastAPI backend inspects uploaded resumes: native digital PDFs extract instantly via `pymupdf` (`fitz`), while scanned documents and images fall back to local `PaddleOCRVL` / `mlx-vlm`. Two parallel async workers process the text with OpenRouter: one streams real-time recruiter ATS audit Markdown via SSE, while the other generates validated Pydantic JSON (`CandidateProfile` & score breakdown) multiplexed onto the same stream. The TanStack frontend renders a 4-tab dashboard (Overview & Scorecard, Formatting Flaws, Bullet Rewrites, and Structured Profile JSON) with a visual score gauge.

**Tech Stack:** Python 3.12, FastAPI, PyMuPDF (fitz), Pydantic v2, OpenAI AsyncClient (OpenRouter), TanStack Start / React 19, Tailwind CSS v4, Biome, Tabler & Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-11-07-ats-resume-parser-design.md`

## Global Constraints
- Operating Systems: macOS (Apple Silicon / MLX-VLM fallback) and Windows (CUDA / PaddleOCR fallback); CPU-only digital PDF extraction.
- OpenRouter API: Standard OpenAI client format via `https://openrouter.ai/api/v1` with `OPENROUTER_API_KEY`.
- Privacy & Cleanup: Temporary uploaded files are always deleted in `finally` blocks; zero persistent file storage.
- Streaming: Output must stream progressively over Server-Sent Events (`text/event-stream`).

## Review Focus
- Plain text / digital PDF with minimal text (< 50 chars per page): System must detect near-empty text layers and fall back to VLM OCR rather than failing.
- Malformed / truncated LLM JSON: Frontend must handle partial or non-parseable JSON gracefully without crashing the UI.
- Missing Job Description: When JD is omitted, the ATS score and overview must benchmark against universal standards without throwing errors or displaying undefined/NaN.
- Unreachable VLM server on macOS: When `mlx-vlm` server is offline on port 8111, fallback to PyMuPDF digital parsing must succeed for digital PDFs, and return an informative error for image files.
- Large multi-page PDF processing: Temp file handling and token counts must remain within safety limits without blocking the async event loop.

---

### Task 1: Hybrid Document Ingestion Engine

**Files:**
- Create: `src-backend/services/extractor.py`
- Modify: `src-backend/requirements.txt`
- Test: `src-backend/tests/test_extractor.py`

**Interfaces:**
- Produces: `extract_document_text(file_path: str, ext: str) -> tuple[str, str]` (returns extracted text and extraction method `digital_pdf` | `vlm_ocr`).

- [ ] **Step 1: Add PyMuPDF dependency to requirements.txt**
Add `pymupdf==1.25.3` and `pytest==8.3.4` to `src-backend/requirements.txt`.

- [ ] **Step 2: Write failing test for extractor service**
Write `src-backend/tests/test_extractor.py`:
```python
import pytest
from services.extractor import extract_document_text

def test_extract_digital_pdf(tmp_path):
    import fitz
    pdf_path = tmp_path / "test_digital.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "John Doe\nSoftware Engineer\nPython, React, TypeScript")
    doc.save(str(pdf_path))
    doc.close()

    text, method = extract_document_text(str(pdf_path), ".pdf")
    assert "John Doe" in text
    assert "Python" in text
    assert method == "digital_pdf"
```

- [ ] **Step 3: Run test to verify it fails**
Run: `cd src-backend && uv run pytest tests/test_extractor.py -v`
Expected: FAIL (ModuleNotFoundError: No module named 'services.extractor')

- [ ] **Step 4: Implement `extract_document_text` in `src-backend/services/extractor.py`**
Implement text extraction with digital PDF detection (> 50 chars) via `fitz`. For scanned PDFs or images, fall back to existing `PaddleOCRVL` pipeline with platform-specific configurations.

- [ ] **Step 5: Run test to verify it passes**
Run: `cd src-backend && uv run pytest tests/test_extractor.py -v`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add src-backend/requirements.txt src-backend/services/extractor.py src-backend/tests/test_extractor.py
git commit -m "feat(backend): add hybrid document extractor with PyMuPDF"
```

---

### Task 2: Pydantic Schema & Dual-Worker AI Pipeline

**Files:**
- Create: `src-backend/schemas/resume.py`
- Create: `src-backend/services/ai_evaluator.py`
- Test: `src-backend/tests/test_ai_evaluator.py`

**Interfaces:**
- Consumes: Extracted resume text from `extractor.py`
- Produces: 
  - `CandidateProfile` schema (`name`, `email`, `phone`, `skills`, `work_experience`, `education`)
  - `ATSScoreBreakdown` schema (`overall_score`, `parseability`, `keyword_relevance`, `formatting_safety`, `metric_impact`, `role_match_score`, `matched_skills`, `missing_skills`)
  - `generate_ats_stream(resume_text: str, job_description: str | None) -> AsyncGenerator[str, None]`

- [ ] **Step 1: Define Pydantic schemas in `src-backend/schemas/resume.py`**
Define `ContactInfo`, `WorkExperienceItem`, `EducationItem`, `SkillCategory`, `CandidateProfile`, and `ATSScoreBreakdown`.

- [ ] **Step 2: Write unit test for schemas and prompt generator**
Write `src-backend/tests/test_ai_evaluator.py` testing prompt construction and schema parsing:
```python
from schemas.resume import CandidateProfile, ATSScoreBreakdown
from services.ai_evaluator import build_audit_prompt, build_schema_prompt

def test_prompts_include_job_description():
    prompt = build_audit_prompt("Resume text", "Target Senior Engineer role")
    assert "Target Senior Engineer role" in prompt
    assert "Google X-Y-Z formula" in prompt

def test_schema_parsing():
    raw_json = {
        "overall_score": 88,
        "parseability": 90,
        "keyword_relevance": 85,
        "formatting_safety": 92,
        "metric_impact": 85,
        "role_match_score": 80,
        "matched_skills": ["Python", "FastAPI"],
        "missing_skills": ["GraphQL"],
        "profile": {
            "name": "Jane Developer",
            "email": "jane@example.com",
            "skills": ["Python", "TypeScript"],
            "experience": [],
            "education": []
        }
    }
    score = ATSScoreBreakdown.model_validate(raw_json)
    assert score.overall_score == 88
    assert score.matched_skills == ["Python", "FastAPI"]
```

- [ ] **Step 3: Run test to verify it fails**
Run: `cd src-backend && uv run pytest tests/test_ai_evaluator.py -v`
Expected: FAIL (ModuleNotFoundError: No module named 'schemas.resume')

- [ ] **Step 4: Implement schemas and async evaluator service**
In `src-backend/services/ai_evaluator.py`:
- Implement `build_audit_prompt` and `build_schema_prompt`.
- Implement `generate_ats_stream(resume_text: str, job_description: str | None)` using `asyncio.create_task` to run Worker 1 (streaming Markdown audit chunks) and Worker 2 (concurrent JSON schema extraction via `response_format={"type": "json_object"}`).
- When Worker 2 completes, yield `data: [STRUCTURED_JSON] <serialized_json>\n\n`.

- [ ] **Step 5: Run test to verify it passes**
Run: `cd src-backend && uv run pytest tests/test_ai_evaluator.py -v`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add src-backend/schemas/resume.py src-backend/services/ai_evaluator.py src-backend/tests/test_ai_evaluator.py
git commit -m "feat(backend): add resume pydantic schemas and dual AI evaluation pipeline"
```

---

### Task 3: API Route Integration

**Files:**
- Modify: `src-backend/routes/files.py`
- Test: `src-backend/tests/test_files_route.py`

**Interfaces:**
- Consumes: `extractor.py` and `ai_evaluator.py`
- Produces: `POST /api/v1/files` taking `file: UploadFile` and optional `job_description: Optional[str] = Form(None)`, returning `StreamingResponse(..., media_type="text/event-stream")`.

- [ ] **Step 1: Write integration test for `POST /api/v1/files`**
Write `src-backend/tests/test_files_route.py` using `httpx.AsyncClient` / `TestClient` to test validation, file processing, and response streaming content-type.

- [ ] **Step 2: Run test to verify it fails or checks updated interface**
Run: `cd src-backend && uv run pytest tests/test_files_route.py -v`
Expected: FAIL or route parameter mismatch.

- [ ] **Step 3: Update `src-backend/routes/files.py`**
Refactor `uploadFile` to:
- Accept `file: UploadFile` and `job_description: Optional[str] = Form(None)`.
- Use `extract_document_text` from `services.extractor`.
- Delegate generation to `generate_ats_stream` from `services.ai_evaluator`.
- Preserve clean temporary file purging in `finally` block.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd src-backend && uv run pytest tests/test_files_route.py -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src-backend/routes/files.py src-backend/tests/test_files_route.py
git commit -m "feat(backend): integrate hybrid extractor and dual AI stream into files route"
```

---

### Task 4: Frontend Stream Parsing & Interactive ATS Dashboard

**Files:**
- Modify: `src/routes/index.tsx`
- Create: `src/components/AtsScoreGauge.tsx`
- Create: `src/components/StructuredProfileView.tsx`

**Interfaces:**
- Consumes: Server-Sent Events from `http://localhost:3001/api/v1/files` (`data: <markdown_chunk>` and `data: [STRUCTURED_JSON] <json_string>`)
- Produces: Responsive 4-tab interactive dashboard with circular ATS Score Gauge, Overview & Scorecard, Formatting Flaws Checklist, Google X-Y-Z Rewrites, and Structured Profile JSON viewer with Copy/Download actions.

- [ ] **Step 1: Implement `AtsScoreGauge.tsx` component**
Create `src/components/AtsScoreGauge.tsx` rendering an animated SVG circular progress ring (0-100) with dynamic color rating (emerald-500 for >= 80, amber-500 for 60-79, rose-500 for < 60) and metric badges.

- [ ] **Step 2: Implement `StructuredProfileView.tsx` component**
Create `src/components/StructuredProfileView.tsx` rendering candidate profile details (Name, Contact, Categorized Skills badges, Work Experience timeline, Education) along with "Copy JSON" and "Download JSON" buttons.

- [ ] **Step 3: Update `src/routes/index.tsx`**
- Add optional expandable "Target Job Description (Optional)" textarea.
- Update SSE reader in `uploadFile` to detect `data: [STRUCTURED_JSON] ` tokens and parse candidate/score data into typed state.
- Split markdown stream or render tabs:
  - Tab 1: Overview & Scorecard (Score Gauge, Parseability, Keyword Match %, Matched & Missing Skills).
  - Tab 2: Formatting & Structural Flaws (ATS-breaking elements checklist).
  - Tab 3: Bullet Point Rewrites (Before & After Google X-Y-Z rewrites).
  - Tab 4: Structured Data (`StructuredProfileView`).
- Maintain pulsing live status during streaming.

- [ ] **Step 4: Run format, lint, and build checks**
Run: `pnpm check && pnpm build`
Expected: Biome check clean (0 errors) and Vite build successful.

- [ ] **Step 5: Commit**
```bash
git add src/routes/index.tsx src/components/AtsScoreGauge.tsx src/components/StructuredProfileView.tsx
git commit -m "feat(frontend): add interactive ATS dashboard with score gauge and multi-tab results"
```

---

### Task 5: End-to-End Verification & Documentation Update

**Files:**
- Modify: `README.md`
- Test: Full end-to-end upload with digital PDF, image resume, and optional Job Description.

- [ ] **Step 1: Verify backend and frontend integration end-to-end**
Start the backend test server, send a sample resume with/without a Job Description, and verify SSE chunks and `[STRUCTURED_JSON]` emission.

- [ ] **Step 2: Update `README.md`**
Update documentation to reflect the hybrid extraction pipeline (PyMuPDF + VLM), the new Job Description matcher, and the multi-tab ATS dashboard.

- [ ] **Step 3: Run full test suite**
Run: `cd src-backend && uv run pytest -v && cd .. && pnpm check && pnpm build`
Expected: All backend tests pass, Biome check passes, frontend builds cleanly.

- [ ] **Step 4: Commit**
```bash
git add README.md
git commit -m "docs: update system architecture and feature list for ATS hybrid parser"
```
