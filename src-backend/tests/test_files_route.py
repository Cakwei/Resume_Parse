import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
import fitz
from main import app

client = TestClient(app)

def test_upload_invalid_extension():
    response = client.post(
        "/api/v1/files",
        files={"file": ("test.exe", b"binarycontent", "application/octet-stream")}
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]

def test_upload_digital_pdf_stream(tmp_path):
    # Create sample PDF
    pdf_path = tmp_path / "resume.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "Jane Smith\nSoftware Engineer\nPython, FastAPI, TypeScript")
    doc.save(str(pdf_path))
    doc.close()

    async def mock_generator(resume_text, job_description=None):
        yield "data: ## 1. ATS Compliance Rating\\n\\n\n\n"
        yield 'data: [STRUCTURED_JSON] {"overall_score": 90}\n\n'

    with patch("routes.files.generate_ats_stream", side_effect=mock_generator):
        with open(pdf_path, "rb") as f:
            response = client.post(
                "/api/v1/files",
                files={"file": ("resume.pdf", f, "application/pdf")},
                data={"job_description": "Senior Backend Developer"}
            )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        body = response.text
        assert "ATS Compliance Rating" in body
        assert "[STRUCTURED_JSON]" in body
