from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend import database, models, auth
from pydantic import BaseModel

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

class PlaylistCreate(BaseModel):
    name: str
    is_public: bool = False

@router.post("/playlists", response_model=dict)
def create_playlist(
    playlist: PlaylistCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    new_playlist = models.Playlist(
        name=playlist.name,
        is_public=playlist.is_public,
        creator_id=current_user.id
    )
    db.add(new_playlist)
    db.commit()
    db.refresh(new_playlist)
    return {"id": new_playlist.id, "name": new_playlist.name}

@router.get("/playlists", response_model=List[dict])
def get_my_playlists(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    playlists = db.query(models.Playlist).filter(models.Playlist.creator_id == current_user.id).all()
    return [{"id": p.id, "name": p.name, "is_public": p.is_public} for p in playlists]

@router.post("/playlists/{playlist_id}/tracks/{track_id}")
def add_track_to_playlist(
    playlist_id: int,
    track_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id, models.Playlist.creator_id == current_user.id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    # Check if track exists
    track = db.query(models.Track).filter(models.Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    # Add to playlist
    playlist_track = models.PlaylistTrack(playlist_id=playlist_id, track_id=track_id)
    db.add(playlist_track)
    db.commit()
    return {"message": "Track added to playlist"}

@router.post("/favorites/{track_id}")
def toggle_favorite(
    track_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    existing = db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id, models.Favorite.track_id == track_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"message": "Removed from favorites", "is_favorite": False}
    else:
        new_fav = models.Favorite(user_id=current_user.id, track_id=track_id)
        db.add(new_fav)
        db.commit()
        return {"message": "Added to favorites", "is_favorite": True}

@router.get("/favorites", response_model=List[dict])
def get_favorites(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    favorites = db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id).all()
    # Return track details
    return [
        {
            "id": f.track.id,
            "title": f.track.title,
            "artist": f.track.artist,
            "album": f.track.album,
            "file_path": f.track.file_path,
            "duration": f.track.duration,
            "album_art_path": f.track.album_art_path,
            "is_public": f.track.is_public,
            "uploader_name": f.track.uploader.name if f.track.uploader else "Unknown",
            "is_favorite": True
        }
        for f in favorites if f.track
    ]

@router.get("/{user_id}", response_model=dict)
def get_user_profile(
    user_id: int,
    db: Session = Depends(database.get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "name": user.name,
        "avatar_url": user.avatar_url
    }

@router.get("/{user_id}/tracks", response_model=List[dict])
def get_user_tracks(
    user_id: int,
    current_user: models.User = Depends(auth.get_current_user_optional), # Use optional auth
    db: Session = Depends(database.get_db)
):
    print(f"DEBUG: Requesting tracks for user_id={user_id}")
    if current_user:
        print(f"DEBUG: Current user: {current_user.id} ({current_user.email})")
    else:
        print("DEBUG: No current user (Anonymous)")
        
    query = db.query(models.Track).filter(models.Track.uploader_id == user_id)
    
    # If not owner, show only public
    if not current_user or current_user.id != user_id:
        print("DEBUG: Not owner, filtering for public only")
        query = query.filter(models.Track.is_public == True)
    else:
        print("DEBUG: Owner detected, showing all tracks")
        
    tracks = query.all()
    print(f"DEBUG: Found {len(tracks)} tracks")
    
    # Get user favorites for efficient checking
    user_favorites = set()
    if current_user:
        favs = db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id).all()
        user_favorites = {f.track_id for f in favs}

    return [
        {
            "id": t.id,
            "title": t.title,
            "artist": t.artist,
            "album": t.album,
            "file_path": t.file_path,
            "duration": t.duration,
            "album_art_path": t.album_art_path,
            "is_public": t.is_public,
            "uploader_name": t.uploader.name if t.uploader else "Unknown",
            "is_favorite": t.id in user_favorites
        }
        for t in tracks
    ]

@router.get("/{user_id}/albums", response_model=List[dict])
def get_user_albums(
    user_id: int,
    current_user: models.User = Depends(auth.get_current_user_optional),
    db: Session = Depends(database.get_db)
):
    # Group tracks by album name
    query = db.query(models.Track).filter(
        models.Track.uploader_id == user_id,
        models.Track.album != None
    )
    
    # If not owner, show only public
    if not current_user or current_user.id != user_id:
        query = query.filter(models.Track.is_public == True)
        
    tracks = query.all()
    
    albums = {}
    for track in tracks:
        if track.album not in albums:
            albums[track.album] = {
                "name": track.album,
                "artist": track.artist, # Assuming album artist is same as track artist for now
                "cover_art": track.album_art_path,
                "tracks": []
            }
        albums[track.album]["tracks"].append({
            "id": track.id,
            "title": track.title,
            "duration": track.duration
        })
        
    return list(albums.values())
