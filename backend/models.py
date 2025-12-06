from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, JSON, Float
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    avatar_url = Column(String, nullable=True)
    
    tracks = relationship("Track", back_populates="uploader")
    playlists = relationship("Playlist", back_populates="creator")
    favorites = relationship("Favorite", back_populates="user")

class Track(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    artist = Column(String, index=True)
    album = Column(String, index=True, nullable=True)
    genre = Column(String, index=True, nullable=True)
    file_path = Column(String)
    duration = Column(Float) # in seconds
    bitrate = Column(String, nullable=True)
    size = Column(Integer) # in bytes
    is_public = Column(Boolean, default=False)
    uploader_id = Column(Integer, ForeignKey("users.id"))
    waveform_data = Column(JSON, nullable=True) # Array of decibels
    album_art_path = Column(String, nullable=True)

    uploader = relationship("User", back_populates="tracks")
    favorited_by = relationship("Favorite", back_populates="track")
    playlist_tracks = relationship("PlaylistTrack", back_populates="track")

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"))
    is_public = Column(Boolean, default=False)

    creator = relationship("User", back_populates="playlists")
    tracks = relationship("PlaylistTrack", back_populates="playlist")

class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"))
    track_id = Column(Integer, ForeignKey("tracks.id"))
    order = Column(Integer, default=0)

    playlist = relationship("Playlist", back_populates="tracks")
    track = relationship("Track", back_populates="playlist_tracks")

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    track_id = Column(Integer, ForeignKey("tracks.id"))

    user = relationship("User", back_populates="favorites")
    track = relationship("Track", back_populates="favorited_by")
