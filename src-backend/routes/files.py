import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, UploadFile
from openai import OpenAI
from paddleocr import PaddleOCRVL

# You can add a prefix and tags for cleaner code and structured Swagger docs
router = APIRouter(prefix="/api/v1/files", tags=["Users Management"])


# 1. Get the path of the current script's directory
current_dir = Path(__file__).resolve().parent

# 2. Point to the .env file in the parent directory (one level up)
env_path = current_dir.parent / '..' / '.env'

# 3. Load the environment variables from that specific path
load_dotenv(dotenv_path=env_path)


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY","")

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
        global prompt

        # for res in output:
            # pass
            # res.print() ## Print the structured prediction output
            # res.save_to_json(save_path=output_dir) ## Save the current image's structured result in JSON format
            # res.save_to_markdown(save_path=output_dir)
            # print(res['parsing_res_list'])
            # print(output[0]['parsing_res_list'])

        print('My ENV: ', os.getenv("OPENROUTER_API_KEY", ""))
        #


        client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
        )

        # First API call with reasoning
        response = client.chat.completions.create(
        model="z-ai/glm-5.2:free",
        messages= [
            {
            'role': 'user',
            'content': f'''
                Act as an expert ATS (Applicant Tracking System) scanner, technical recruiter, and professional resume writer with 15+ years of experience. 

                I want you to analyze my current resume based on industry-standard ATS-friendliness, modern hiring guidelines, and recruitment best practices. Do not fabricate or invent any new work experiences, job titles, or metrics—strictly use the factual background provided.

                Here is my resume detected by OCR:
                {output[0]['parsing_res_list']}

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

        # Extract the assistant message with reasoning_details
        response = response.choices[0].message.content
        print(response, "Testing")
        return {
            'success': True,
            'data': {
                'prompt': response, 
            }
        }
    except Exception as e:  # noqa: BLE001
        print(e) 
