from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from backend import database, models, auth, audio_processor
import shutil
import os
import uuid

router = APIRouter(
    prefix="/tracks",
    tags=["tracks"],
)

UPLOAD_DIR = "uploads"

@router.post("/", response_model=dict)
async def upload_track(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    artist: Optional[str] = Form(None),
    album: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    is_public: bool = Form(False),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Extract metadata
    metadata = audio_processor.get_audio_metadata(file_path)
    if not metadata:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="Invalid audio file")
        
    # Extract waveform
    waveform = audio_processor.extract_waveform(file_path)
    
    # Create DB entry
    new_track = models.Track(
        title=title or metadata['title'],
        artist=artist or metadata['artist'],
        album=album or metadata['album'],
        genre=genre or metadata['genre'],
        file_path=file_path,
        duration=metadata['duration'],
        bitrate=str(metadata['bitrate']),
        size=metadata['size'],
        is_public=is_public,
        uploader_id=current_user.id,
        waveform_data=waveform,
        album_art_path=metadata.get('album_art_path')
    )
    
    db.add(new_track)
    db.commit()
    db.refresh(new_track)
    
    return {"message": "Track uploaded successfully", "track_id": new_track.id}

@router.get("/", response_model=List[dict])
def get_tracks(
    skip: int = 0, 
    limit: int = 100, 
    public_only: bool = False,
    current_user: Optional[models.User] = Depends(auth.get_current_user), # Optional auth for public tracks
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Track)
    
    if public_only:
        query = query.filter(models.Track.is_public == True)
    elif current_user:
        # Show user's tracks AND public tracks
        query = query.filter((models.Track.uploader_id == current_user.id) | (models.Track.is_public == True))
    else:
        # If not logged in, only show public
        query = query.filter(models.Track.is_public == True)
        
    tracks = query.offset(skip).limit(limit).all()
    
    # Get user favorites for efficient checking
    user_favorites = set()
    if current_user:
        favs = db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id).all()
        user_favorites = {f.track_id for f in favs}

    # Serialize manually to avoid Pydantic recursion issues for now, or use schemas
    return [
        {
            "id": t.id,
            "title": t.title,
            "artist": t.artist,
            "album": t.album,
            "file_path": t.file_path,
            "duration": t.duration,
            "waveform_data": t.waveform_data,
            "album_art_path": t.album_art_path,
            "is_public": t.is_public,
            "uploader_name": t.uploader.name if t.uploader else "Unknown",
            "is_favorite": t.id in user_favorites
        }
        for t in tracks
    ]

@router.post("/scan")
def scan_directory(
    directory_path: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    print(f"Scanning directory: '{directory_path}'")
    print(f"Exists: {os.path.exists(directory_path)}, IsDir: {os.path.isdir(directory_path)}")
    
    if not os.path.isdir(directory_path):
        raise HTTPException(status_code=400, detail=f"Invalid directory path: {directory_path}")
        
    print(f"DEBUG: Starting scan for User ID: {current_user.id}")
    added_count = 0
    skipped_count = 0
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.flac', '.m4a')):
                full_path = os.path.join(root, file)
                print(f"DEBUG: Found audio file: {full_path}")
                
                # Check if already exists for THIS user
                existing = db.query(models.Track).filter(
                    models.Track.file_path == full_path,
                    models.Track.uploader_id == current_user.id
                ).first()
                
                if existing:
                    print(f"DEBUG: Skipping duplicate for User {current_user.id}: {full_path}")
                    skipped_count += 1
                    continue
                else:
                    print(f"DEBUG: No duplicate found for User {current_user.id}. Proceeding to metadata.")
                    
                metadata = audio_processor.get_audio_metadata(full_path)
                if metadata:
                    print(f"DEBUG: Metadata extracted successfully for: {full_path}")
                    print(f"DEBUG: Album Art Path: {metadata.get('album_art_path')}")
                    waveform = audio_processor.extract_waveform(full_path)
                    new_track = models.Track(
                        title=metadata['title'],
                        artist=metadata['artist'],
                        album=metadata['album'],
                        genre=metadata['genre'],
                        file_path=full_path, # Use original path
                        duration=metadata['duration'],
                        bitrate=str(metadata['bitrate']),
                        size=metadata['size'],
                        is_public=False, # Default to private
                        uploader_id=current_user.id,
                        waveform_data=waveform,
                        album_art_path=metadata.get('album_art_path')
                    )
                    db.add(new_track)
                    added_count += 1
                    print(f"DEBUG: Track added to session: {new_track.title}")
                else:
                    print(f"DEBUG: Failed to extract metadata for: {full_path}")
    
    try:
        db.commit()
        print(f"DEBUG: DB Commit successful. Added: {added_count}, Skipped: {skipped_count}")
    except Exception as e:
        print(f"DEBUG: DB Commit FAILED: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")
        
    return {"message": f"Scanned {added_count} new tracks. {skipped_count} tracks already existed."}

@router.get("/{track_id}/stream")
def stream_track(
    track_id: int,
    db: Session = Depends(database.get_db)
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    if not os.path.exists(track.file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    from fastapi.responses import StreamingResponse
    import mimetypes
    
    # Determine content type
    content_type = mimetypes.guess_type(track.file_path)[0] or "audio/mpeg"
    
    def iter_file():
        with open(track.file_path, "rb") as f:
            while chunk := f.read(65536):  # 64KB chunks
                yield chunk
    
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Content-Disposition": f'inline; filename="{os.path.basename(track.file_path)}"',
    }
    
    return StreamingResponse(
        iter_file(),
        media_type=content_type,
        headers=headers
    )

@router.put("/{track_id}/publish")
def publish_track(
    track_id: int,
    publish: bool,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    if track.uploader_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    track.is_public = publish
    db.commit()
    return {"message": f"Track {'published' if publish else 'unpublished'}"}

@router.get("/{track_id}", response_model=dict)
def get_track_details(
    track_id: int,
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(database.get_db)
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    # Visibility check
    if not track.is_public:
        if not current_user or track.uploader_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this track")
            
    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "genre": track.genre,
        "file_path": track.file_path,
        "duration": track.duration,
        "bitrate": track.bitrate,
        "size": track.size,
        "waveform_data": track.waveform_data,
        "album_art_path": track.album_art_path,
        "is_public": track.is_public,
        "uploader_id": track.uploader_id,
        "uploader_id": track.uploader_id,
        "uploader_name": track.uploader.name if track.uploader else "Unknown",
        "is_favorite": db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id, models.Favorite.track_id == track.id).first() is not None if current_user else False
        # "created_at": track.created_at.isoformat() if track.created_at else None # Removed as column doesn't exist yet
    }

class TrackUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None

@router.put("/{track_id}")
def update_track_details(
    track_id: int,
    track_update: TrackUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    if track.uploader_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this track")
        
    if track_update.title is not None:
        track.title = track_update.title
    if track_update.artist is not None:
        track.artist = track_update.artist
    if track_update.album is not None:
        track.album = track_update.album
    if track_update.genre is not None:
        track.genre = track_update.genre
        
    db.commit()
    db.refresh(track)
    
    return {"message": "Track updated successfully", "track": {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "genre": track.genre
    }}

@router.delete("/{track_id}")
def delete_track(
    track_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    if track.uploader_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this track")
        
    # Delete file
    if os.path.exists(track.file_path):
        try:
            os.remove(track.file_path)
        except Exception as e:
            print(f"Error deleting file {track.file_path}: {e}")
            
    db.delete(track)
    db.commit()
    
    return {"message": "Track deleted successfully"}
