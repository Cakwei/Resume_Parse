import uvicorn
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

# Main block to run the app directly
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=3001, reload=True)
