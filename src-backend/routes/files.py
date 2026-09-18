import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from ollama import ChatResponse, chat
from paddleocr import PaddleOCRVL

# You can add a prefix and tags for cleaner code and structured Swagger docs
router = APIRouter(prefix="/api/v1/files", tags=["Users Management"])

@router.post("")
async def uploadFile(file: UploadFile):
    temp_file_path = None

    try:
        output_dir = Path("./output")
        output_dir.mkdir(parents=True, exist_ok=True)

            # Validatex`` file type
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file selected")
        
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp', '.pdf')):
            raise HTTPException(
                status_code=400,
                detail='Unsupported file type. Use PNG, JPG, JPEG, BMP, TIFF, or WEBP'
            )
        
        # Check file size (5MB limit)
        contents = await file.read()
        if len(contents) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 20MB.")
        
        # Save uploaded file to temporary file with correct extension
        _, ext = os.path.splitext(file.filename)
        ext = ext.lower() if ext else '.jpg'
        
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_file:
            tmp_file.write(contents)
            temp_file_path = tmp_file.name
        
        pipeline = PaddleOCRVL(
            use_layout_detection=False,
            vl_rec_backend="mlx-vlm-server", 
            vl_rec_server_url="http://localhost:8111/",
            vl_rec_api_model_name="PaddlePaddle/PaddleOCR-VL-1.6",
        )

        output = pipeline.predict(input=temp_file_path)
        for res in output:
            pass
            # res.print() ## Print the structured prediction output
            # res.save_to_json(save_path=output_dir) ## Save the current image's structured result in JSON format
            # res.save_to_markdown(save_path=output_dir)
            # print(res['parsing_res_list'])

        # print(output[0]['parsing_res_list'])
        response: ChatResponse = chat(
                        model='gemma4',
                        messages=[
                            {
                            'role': 'user',
                            'content': f'''
                                Act as an expert ATS (Applicant Tracking System) scanner, technical recruiter, and professional resume writer with 15+ years of experience. 
            
                                I want you to analyze my current resume against the provided job description. Do not fabricate or invent any new work experiences, job titles, or metrics—strictly use the factual background provided in my resume.
            
                                Here is my Current Resume parsed by OCR:
                                {output[0]['parsing_res_list']}
            
                                Please provide your output in the following clear sections:
                                1. ATS Match Score: Give an estimated match percentage (0-100%) based on keyword alignment, skills overlap, and experience relevance.
                                2. Critical Missing Keywords & Skills: List the hard skills, soft skills, and tools mentioned in the job description that are missing or underrepresented in my resume.
                                3. Section-by-Section Weaknesses: Point out any vague bullet points, missing metrics, or poor formatting choices that would hurt my ranking.
                                4. Tailored Rewrite: Rewrite my professional summary and work experience bullet points to          
                            ''',
                            },
                        ],
                        )
        prompt =  response['message']['content']
            
        return {
            'success': True,
            'data': {
                prompt 
            }
        }
    except Exception as e:  # noqa: BLE001
        print(e) 
