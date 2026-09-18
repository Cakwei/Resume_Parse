from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.files import router as filesRoute

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # List of allowed origins
    allow_credentials=True,          # Allow cookies and auth headers
    allow_methods=["*"],             # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],             # Allow all request headers
)


app.include_router(filesRoute)

@app.get("/api/v1/health")
async def pingHealth():
    return {
        "success": True
    }