from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from backend directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from backend import models, database
from backend.routers import auth, tracks, users, albums

# Create tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Spotify Clone API")

# CORS
origins = [
    "http://localhost:5173",  # Vite default port
    "http://localhost:5174",  # Vite fallback port
    "http://localhost:3008",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for audio serving
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(tracks.router)
app.include_router(users.router)
app.include_router(albums.router)

@app.get("/")
def read_root():
    return {"message": "Spotify Clone API is running"}
