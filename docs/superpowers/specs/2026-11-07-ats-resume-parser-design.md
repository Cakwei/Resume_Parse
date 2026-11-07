# Design Document: ATS Resume Intelligence & Hybrid Parser

## Intent & The "Why"
Resumes are typically parsed to assess ATS (Applicant Tracking System) friendliness, identify missing competencies against target roles, and extract structured candidate data. Currently, the application relies solely on a local VLM (PaddleOCR / MLX-VLM), which is resource-heavy, requires an active local model server, and lacks fast-path extraction for native digital PDFs (the vast majority of uploaded resumes). Furthermore, the response is unstructured Markdown dumped into a single text box without ATS visual metrics, structured candidate JSON export, or Job Description (JD) matching.

This project enhances the parsing engine with a high-speed hybrid extraction pipeline (PyMuPDF + VLM fallback), adds structured schema extraction alongside streaming ATS critique, introduces an optional Target Job Description keyword analysis feature, and transforms the frontend into an intuitive, multi-tab ATS intelligence dashboard.

---

## Goals, Non-Goals, & Anti-Goals

### Goals
1. **Hybrid Ingestion Pipeline**: Fast, sub-second extraction for native digital PDFs using `pymupdf` (`fitz`), while gracefully falling back to `PaddleOCRVL` / `mlx-vlm` for scanned PDFs and image files (`.png`, `.jpg`, `.webp`).
2. **Dual-Payload Intelligence**:
   - Streamed ATS recruiter audit (0–100 score, formatting/structural flaws checklist, bullet audit, Google X-Y-Z rewrites).
   - Structured JSON candidate data extraction (Personal info, Skills list, Work Experience, Education) validated via Pydantic schemas.
3. **Target Job Description Matching (Optional)**: Allow users to paste a job description to perform hard/soft skill gap analysis and compute a role-specific match percentage.
4. **Interactive ATS Dashboard UI**:
   - Color-coded circular/linear ATS score gauge.
   - Tabbed layout: **Overview & Scorecard**, **Formatting Flaws & Audit**, **Bullet Rewrites (Before vs. After)**, and **Structured JSON (with one-click Copy / Download)**.
   - Retain responsive drag-and-drop file upload with clear state indicators.

### Non-Goals
1. Full in-browser WYSIWYG resume authoring/editing studio (handled in future iterations).
2. Permanent database storage or user authentication (privacy-first: temporary in-memory/temp-file processing only).
3. Multi-resume batch processing (focus remains on single resume deep-audit).

### Anti-Goals
1. Never fabricate fake companies, titles, or metrics during rewrites.
2. Avoid blocking or crashing if MLX-VLM or PaddleOCR is unavailable when parsing digital PDFs.
3. Avoid replacing streaming with a slow blocking REST response—preserve real-time feedback during AI reasoning.

---

## Constraints
1. **Operating Systems**: Must function on macOS (Apple Silicon / MLX-VLM fallback) and Windows (CUDA / PaddleOCR fallback), as well as standard CPU environments for digital PDFs.
2. **API Keys**: Uses OpenRouter API (`OPENROUTER_API_KEY`) with existing OpenAI async client.
3. **Tech Stack**: FastAPI backend (Python 3.12), TanStack Start / Vite / React 19 frontend, Tailwind CSS v4, Biome.

---

## Approaches Considered

### Approach 1: Core Reliability & Hybrid Parsing (Lean)
- Add `pymupdf` for digital PDFs and keep `PaddleOCR`/`mlx-vlm` as image fallback.
- Backend outputs single combined Markdown block with raw JSON embedded in a code block.
- Frontend remains a single-view markdown viewer with copy button.
- *Pros*: Quickest to build.
- *Cons*: Misses visual ATS metrics, lacks job description matching, poor UX for structured data.

### Approach 2: Full ATS Intelligence & Structured Breakdown (Selected)
- Implement hybrid ingestion (PyMuPDF + VLM fallback).
- Add optional Target Job Description input for tailored keyword analysis.
- Dual output: validated Pydantic JSON extraction + streamed recruiter ATS audit.
- Modern dashboard UI with visual score gauge, categorized tabs (Overview, Audit, Rewrites, JSON), and export tools.
- *Trade-offs*: Requires coordinated UI state and tabbed components, but delivers high user value and fulfills the complete project vision.

### Approach 3: ATS Optimizer + Exportable Resume Builder
- Includes Approach 2 plus rich in-browser editing and PDF/DOCX generation.
- *Pros*: Full end-to-end resume builder.
- *Cons*: High scope expansion, complex document formatting libraries, out of proportion for current phase.

---

## System Architecture & Technical Specifications

```mermaid
flowchart TD
    subgraph Frontend [TanStack React UI]
        U[Upload Dropzone: PDF / Image]
        JD[Optional: Target Job Description]
        Tabs[Tabs: Scorecard | Flaws | Rewrites | JSON]
    end

    subgraph Backend [FastAPI Engine]
        Router["/api/v1/files (POST Multipart)"]
        Inspector{Is Digital PDF?}
        PyMuPDF["PyMuPDF (fitz) Engine"]
        VLM["PaddleOCR / MLX-VLM Engine"]
        LLM["OpenRouter AI (Streamed)"]
    end

    U --> Router
    JD --> Router
    Router --> Inspector
    Inspector -- Yes (Text found) --> PyMuPDF
    Inspector -- No (Scanned/Image) --> VLM
    PyMuPDF --> LLM
    VLM --> LLM
    LLM -->|SSE Stream: Chunks + JSON| Tabs
```

### 1. Document Extraction Pipeline (`src-backend/routes/files.py`)
- For uploaded files:
  - If `.pdf`: Inspect page text with `fitz` (`pymupdf`). If extracted text length across pages exceeds a threshold (e.g., > 150 characters), extract clean text and layout metadata directly in milliseconds.
  - If `.pdf` has no embedded text (scanned) or file is `.png`, `.jpg`, `.webp`: Route to local VLM engine (`PaddleOCRVL` on Windows or `mlx-vlm` on macOS).
  - Graceful fallback: If VLM server is not running on macOS, provide a clear, helpful error message rather than a silent hung process.

### 2. Prompt & Streaming Protocol
- Route signature accepts optional `job_description: Optional[str] = Form(None)`.
- Streaming via Server-Sent Events (`text/event-stream`):
  - Stream chunks are formatted to deliver clean real-time Markdown.
  - An end-of-stream event or structured JSON extraction block provides parsed candidate profile schema (Contact info, Skills array, Experience items, Education items, ATS Score Breakdown).

### 3. Frontend Dashboard Architecture (`src/routes/index.tsx`)
- **Input Zone**:
  - File Dropzone (PDF, PNG, JPG, WEBP).
  - Collapsible / expandable "Target Job Description (Optional)" text area.
  - "Analyze Resume" trigger button.
- **Results Dashboard**:
  - **Header Bar**: Resume filename, overall ATS Score Gauge (e.g. 84/100, colored green/yellow/red), and quick summary stats.
  - **Tab 1: Overview & Scorecard**: Key metric breakdown (Parseability, Keyword Relevance, Formatting, Impact/Metrics).
  - **Tab 2: Formatting & Structural Flaws**: Identified ATS blockers, missing standard sections, font/table warnings.
  - **Tab 3: Bullet Point Rewrites**: Before & After comparison with Google X-Y-Z formula (`Accomplished X as measured by Y, by doing Z`).
  - **Tab 4: Structured Data**: Clean JSON viewer with "Copy JSON" and "Download JSON" buttons.

---

## Architecture Decisions (Resolved from Builder Review)

1. **LLM Execution Strategy: Parallel Asynchronous Workers**:
   - **Call 1 (Streaming ATS Recruiter Audit)**: Fast streaming response using OpenRouter SSE. Delivers the ATS rating, formatting flaws, bullet audit, and Google X-Y-Z rewrites directly to the UI with sub-second time-to-first-token.
   - **Call 2 (Structured Profile JSON)**: Concurrent `json_object` structured extraction using Pydantic schema (`CandidateProfile`: contact, education, work experience, skills). Ran via `asyncio.create_task` and emitted over SSE as a dedicated event `data: [STRUCTURED_JSON] {...}` once completed.
   - *Rationale*: Eliminates token limit blowout and ensures Pydantic JSON is 100% valid without delaying the real-time critique stream.

2. **Tab Data Architecture & Streaming UX**:
   - While streaming: The dashboard displays a pulsing "Analyzing Resume..." status banner, animated skeleton gauge, and live streaming output.
   - Upon completion: The score gauge illuminates (0-100), metric badges activate, and the user can fluidly toggle between **Scorecard & Overview**, **Flaws & Formatting**, **Optimized Rewrites**, and **Structured JSON**.

3. **Optional Job Description (JD) Logic & Placement**:
   - When JD is provided: An overall **Role Match %** is computed alongside the ATS score. Matched skills vs. missing skills are rendered in a dedicated "Role Skill Gap" card inside **Tab 1 (Overview & Scorecard)**.
   - When JD is omitted: The ATS score reflects universal ATS parseability, formatting safety, and bullet-point impact. The gauge displays universal ATS score, and the Skill Gap card displays "Universal Recruiter Benchmark (Add a JD for tailored matching)".

---

## What's Left to the Builder
1. Specific threshold for classifying a PDF as "digital" vs "scanned image" in PyMuPDF (recommended: > 150 characters total or > 50 characters per page).
2. Exact UI tab styling and color palette using existing Tailwind CSS and Tabler/Lucide icons.
3. Stream parser buffering logic on the frontend to cleanly separate streamed markdown and structured JSON data.
