import os
import tempfile
import asyncio
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, Form
from fastapi.responses import StreamingResponse

from services.extractor import extract_document_text
from services.ai_evaluator import generate_ats_stream

router = APIRouter(prefix="/api/v1/files", tags=["Resume Processing"])

ALLOWED_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp', '.pdf')
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

@router.post("")
async def uploadFile(
    file: UploadFile,
    job_description: Optional[str] = Form(None)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    _, ext = os.path.splitext(file.filename)
    ext = ext.lower() if ext else '.jpg'
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed types: PDF, PNG, JPG, JPEG, BMP, TIFF, WEBP"
        )
    
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 20MB.")
    
    # Save to temp file for extraction
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_file:
        tmp_file.write(contents)
        temp_file_path = tmp_file.name

    try:
        # Offload CPU/inference extraction to worker thread to avoid blocking FastAPI event loop
        extracted_text, method = await asyncio.to_thread(extract_document_text, temp_file_path, ext)
    except Exception as extract_err:
        raise HTTPException(status_code=500, detail=str(extract_err))
    finally:
        # Purge temporary file immediately once extraction is done
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass

    if not extracted_text or not extracted_text.strip():
        raise HTTPException(status_code=422, detail="No readable text could be extracted from this document.")

    # Return dual-pipeline stream (Markdown critique + Structured JSON)
    return StreamingResponse(
        generate_ats_stream(extracted_text, job_description),
        media_type="text/event-stream"
    )
