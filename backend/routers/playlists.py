from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, database, auth
import shutil
from pathlib import Path

router = APIRouter(prefix="/playlists", tags=["playlists"])

# Create playlist
@router.post("/")
async def create_playlist(
    name: str,
    is_public: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    playlist = models.Playlist(
        name=name,
        creator_id=current_user.id,
        is_public=is_public
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return {
        "id": playlist.id,
        "name": playlist.name,
        "is_public": playlist.is_public,
        "track_count": 0
    }

# List user's playlists
@router.get("/")
async def get_playlists(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    playlists = db.query(models.Playlist).filter(
        models.Playlist.creator_id == current_user.id
    ).all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "is_public": p.is_public,
            "track_count": len(p.tracks),
            "thumbnail_path": p.thumbnail_path
        }
        for p in playlists
    ]

# Get playlist details with tracks
@router.get("/{playlist_id}")
async def get_playlist(
    playlist_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user_optional)
):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Check access
    if not playlist.is_public and (not current_user or current_user.id != playlist.creator_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get tracks with order
    playlist_tracks = db.query(models.PlaylistTrack).filter(
        models.PlaylistTrack.playlist_id == playlist_id
    ).order_by(models.PlaylistTrack.order).all()
    
    # Get favorite IDs for current user
    user_favorites = set()
    if current_user:
        favorites = db.query(models.Favorite.track_id).filter(
            models.Favorite.user_id == current_user.id
        ).all()
        user_favorites = {f.track_id for f in favorites}
    
    tracks = []
    for pt in playlist_tracks:
        track = pt.track
        tracks.append({
            "id": track.id,
            "title": track.title,
            "artist": track.artist,
            "album": track.album,
            "duration": track.duration,
            "album_art_path": track.album_art_path,
            "is_public": track.is_public,
            "uploader_name": track.uploader.name if track.uploader else "Unknown",
            "is_favorite": track.id in user_favorites
        })
    
    return {
        "id": playlist.id,
        "name": playlist.name,
        "is_public": playlist.is_public,
        "thumbnail_path": playlist.thumbnail_path,
        "creator_name": playlist.creator.name if playlist.creator else "Unknown",
        "creator_id": playlist.creator_id,
        "track_count": len(tracks),
        "tracks": tracks
    }

# Update playlist
@router.put("/{playlist_id}")
async def update_playlist(
    playlist_id: int,
    name: Optional[str] = None,
    is_public: Optional[bool] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if name is not None:
        playlist.name = name
    if is_public is not None:
        playlist.is_public = is_public
    
    db.commit()
    return {"message": "Playlist updated", "id": playlist.id}

# Upload playlist thumbnail
@router.post("/{playlist_id}/thumbnail")
async def upload_playlist_thumbnail(
    playlist_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save thumbnail
    thumbnail_dir = Path("uploads/playlist_thumbnails")
    thumbnail_dir.mkdir(parents=True, exist_ok=True)
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    thumbnail_filename = f"playlist_{playlist_id}.{ext}"
    thumbnail_path = thumbnail_dir / thumbnail_filename
    
    with open(thumbnail_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    playlist.thumbnail_path = f"uploads/playlist_thumbnails/{thumbnail_filename}"
    db.commit()
    
    return {"message": "Thumbnail uploaded", "thumbnail_path": playlist.thumbnail_path}

# Delete playlist
@router.delete("/{playlist_id}")
async def delete_playlist(
    playlist_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete playlist tracks first
    db.query(models.PlaylistTrack).filter(
        models.PlaylistTrack.playlist_id == playlist_id
    ).delete()
    
    db.delete(playlist)
    db.commit()
    return {"message": "Playlist deleted"}

# Add track to playlist
@router.post("/{playlist_id}/tracks/{track_id}")
async def add_track_to_playlist(
    playlist_id: int,
    track_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Check if already in playlist
    existing = db.query(models.PlaylistTrack).filter(
        models.PlaylistTrack.playlist_id == playlist_id,
        models.PlaylistTrack.track_id == track_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Track already in playlist")
    
    # Get max order
    max_order = db.query(models.PlaylistTrack).filter(
        models.PlaylistTrack.playlist_id == playlist_id
    ).count()
    
    playlist_track = models.PlaylistTrack(
        playlist_id=playlist_id,
        track_id=track_id,
        order=max_order
    )
    db.add(playlist_track)
    db.commit()
    
    return {"message": "Track added to playlist"}

# Remove track from playlist
@router.delete("/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(
    playlist_id: int,
    track_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    playlist_track = db.query(models.PlaylistTrack).filter(
        models.PlaylistTrack.playlist_id == playlist_id,
        models.PlaylistTrack.track_id == track_id
    ).first()
    
    if not playlist_track:
        raise HTTPException(status_code=404, detail="Track not in playlist")
    
    db.delete(playlist_track)
    db.commit()
    
    return {"message": "Track removed from playlist"}
