import os
import platform
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse  # 👈 Import this
from openai import AsyncOpenAI
from paddleocr import PaddleOCRVL

router = APIRouter(prefix="/api/v1/files", tags=["Users Management"])

current_dir = Path(__file__).resolve().parent
env_path = current_dir.parent / '..' / '.env'
load_dotenv(dotenv_path=env_path)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY","")

@router.post("")
async def uploadFile(file: UploadFile):
    output_dir = Path("./output")
    output_dir.mkdir(parents=True, exist_ok=True)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp', '.pdf')):
        raise HTTPException(
            status_code=400,
            detail='Unsupported file type. Use PNG, JPG, JPEG, BMP, TIFF, or WEBP'
        )
    
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 20MB.")
    
    _, ext = os.path.splitext(file.filename)
    ext = ext.lower() if ext else '.jpg'
    
    # Keep temp file handling clean
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_file:
        tmp_file.write(contents)
        temp_file_path = tmp_file.name

    try:
        if platform.system() == "Windows":
            pipeline = PaddleOCRVL(
                use_layout_detection=False,
                vl_rec_api_model_name="PaddlePaddle/PaddleOCR-VL-1.6",
            )
        else: 
             pipeline = PaddleOCRVL(
                use_layout_detection=False,
                vl_rec_backend="mlx-vlm-server", 
                vl_rec_server_url="http://localhost:8111/",
                vl_rec_api_model_name="PaddlePaddle/PaddleOCR-VL-1.6",
            )
             
        output = pipeline.predict(input=temp_file_path)
        ocr_text = output[0]['parsing_res_list']

        client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )

        # Streaming of AI response
        async def ai_stream_generator():
            try:
                response = await client.chat.completions.create(
                    stream=True,
                    model="openrouter/free",
                    messages=[
                        {
                            'role': 'user',
                            'content': f'''
                            Act as an expert ATS (Applicant Tracking System) scanner, technical recruiter, and professional resume writer with 15+ years of experience. 

                            I want you to analyze my current resume based on industry-standard ATS-friendliness, modern hiring guidelines, and recruitment best practices. Do not fabricate or invent any new work experiences, job titles, or metrics—strictly use the factual background provided.

                            Here is my resume detected by OCR:
                            {ocr_text}

                            Please provide your output in the following clear sections:
                            1. ATS Compliance Rating: Give an estimated score (0-100%) based on structural parseability, formatting safety, and structural best practices.
                            2. Structural & Formatting Flaws: Identify any elements that will break an ATS parser (e.g., tables, columns, text boxes, headers/footers, special fonts, icons, or missing standard section titles).
                            3. Bullet Point & Metrics Audit: Point out vague bullet points, missing quantifiable achievements (metrics/KPIs), and weak action verbs.
                            4. Optimized Rewrite: Rewrite my professional summary and work experience bullet points to maximize impact, use strong action verbs, and follow the Google X-Y-Z formula (Accomplished [X] as measured by [Y], by doing [Z]), while strictly adhering to my actual, factual background.
                            ''',
                        },
                    ],
                    extra_body={"reasoning": {"enabled": True}}
                )
                
                async for chunk in response:
                    if chunk.choices and len(chunk.choices) > 0:
                        content = chunk.choices[0].delta.content
                        if content:
                            # \n line fix for frontend
                            safe_content = content.replace("\n", "\\n")
                            yield f"data: {safe_content}\n\n"

            except Exception as stream_err:
                yield f"data: Error during streaming: {str(stream_err)}\n\n"
            finally:
                # Cleanup the temp file after streaming completes or drops
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)

        # 2. Return the generator wrapped inside FastAPI's StreamingResponse
        return StreamingResponse(ai_stream_generator(), media_type="text/event-stream")

    except Exception as e:
        # Cleanup temp file if an error happens before streaming begins
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        print(f"Initialization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
