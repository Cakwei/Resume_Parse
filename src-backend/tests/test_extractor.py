import pytest
import os
import tempfile
import fitz
from services.extractor import extract_document_text

def test_extract_digital_pdf(tmp_path):
    pdf_path = tmp_path / "test_digital.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "John Doe\nSoftware Engineer\nSkills: Python, React, TypeScript\nExperience: 5 years at TechCorp.")
    doc.save(str(pdf_path))
    doc.close()

    text, method = extract_document_text(str(pdf_path), ".pdf")
    assert "John Doe" in text
    assert "Python" in text
    assert method == "digital_pdf"

def test_extract_sparse_scanned_pdf_falls_back(tmp_path):
    # Multi-page PDF with very sparse text (< 50 chars per page average) should fall back to OCR
    pdf_path = tmp_path / "test_sparse.pdf"
    doc = fitz.open()
    for _ in range(5):
        page = doc.new_page()
        page.insert_text((50, 72), "Header")  # 6 chars per page = 30 chars total
    doc.save(str(pdf_path))
    doc.close()

    try:
        text, method = extract_document_text(str(pdf_path), ".pdf")
        assert method == "vlm_ocr"
    except Exception as e:
        assert "VLM" in str(e) or "PaddleOCR" in str(e) or "connection" in str(e).lower()
