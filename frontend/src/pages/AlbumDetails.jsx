import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import TrackList from '../components/TrackList';
import { FaPlay, FaPause, FaEdit, FaSave, FaTimes, FaMusic, FaGlobe, FaLock, FaTrash, FaCamera, FaHeart } from 'react-icons/fa';

const AlbumDetails = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { albumId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast, confirmAction } = useUI();
    const [album, setAlbum] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ new_name: '', artist: '' });

    useEffect(() => {
        fetchAlbum();
    }, [albumId]);

    const fetchAlbum = async () => {
        try {
            const res = await client.get(`/albums/${albumId}`);
            setAlbum(res.data);
            setEditForm({
                new_name: res.data.name,
                artist: res.data.artist || '',
            });
        } catch (error) {
            console.error('Error fetching album:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayAlbum = () => {
        if (currentTrack && album.tracks.some(t => t.id === currentTrack.id)) {
            onTogglePlay();
            return;
        }
        if (album && album.tracks.length > 0) {
            onPlay(album.tracks[0], album.tracks);
        }
    };

    const handleThumbnailUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await client.post(`/tracks/album/${album.id}/thumbnail`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAlbum(prev => ({ ...prev, album_art_path: res.data.album_art_path }));
            showToast('Album art updated', 'success');
        } catch (error) {
            console.error("Error uploading album art:", error);
            showToast("Failed to upload album art", 'error');
        }
    };

    const handleSave = async () => {
        try {
            const res = await client.put(`/albums/${albumId}`, editForm);
            setAlbum(prev => ({ 
                ...prev, 
                name: editForm.new_name,
                artist: editForm.artist 
            }));
            setIsEditing(false);
            showToast('Album updated', 'success');
        } catch (error) {
            console.error('Error updating album:', error);
            showToast('Failed to update album', 'error');
        }
    };

    const handleDelete = async () => {
        confirmAction("Are you sure you want to delete this album and all its tracks?", async () => {
            try {
                await client.delete(`/albums/${albumId}`);
                navigate('/');
                showToast('Album deleted', 'success');
            } catch (error) {
                console.error("Error deleting album:", error);
                showToast("Failed to delete album", 'error');
            }
        }, "Delete Album");
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!album) return <div className="text-white p-8">Album not found</div>;

    const isPlayingThisAlbum = isPlaying && currentTrack && album.tracks.some(t => t.id === currentTrack.id);
    // Use loose equality for safety between string/number IDs
    const isOwner = user && album.is_owner === true;

    // Simulate dynamic background color (would normally extract from image)
    const bgColor = 'from-[#503e3e]'; 

    return (
        <div className="text-white pb-32">
            {/* Hero Section */}
            <div className={`flex flex-col md:flex-row gap-6 p-8 items-end bg-gradient-to-b ${bgColor} to-[#121212] pt-24`}>
                {/* Album Art */}
                <div className="w-52 h-52 shadow-[0_4px_60px_rgba(0,0,0,0.5)] flex-shrink-0 bg-[#282828] group relative rounded-sm">
                    {album.album_art_path ? (
                        <img src={`http://localhost:8000/${album.album_art_path}`} className="w-full h-full object-cover rounded-sm" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500"><FaMusic size={64} /></div>
                    )}
                    {isOwner && (
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity rounded-sm">
                            <div className="text-center">
                                <FaCamera size={24} className="mx-auto mb-2" />
                                <span className="text-xs font-bold uppercase">Change Image</span>
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleThumbnailUpload}
                            />
                        </label>
                    )}
                </div>

                {/* Metadata */}
                <div className="flex flex-col gap-2 flex-grow min-w-0">
                    <span className="uppercase text-xs font-bold tracking-wider text-white">Album</span>
                    
                    {isEditing ? (
                        <div className="flex flex-col gap-3 max-w-xl">
                            <input 
                                value={editForm.new_name}
                                onChange={(e) => setEditForm({...editForm, new_name: e.target.value})}
                                className="text-4xl font-black bg-white/10 p-2 rounded focus:outline-none focus:ring-2 focus:ring-white"
                                placeholder="Album Name"
                            />
                            <input 
                                value={editForm.artist}
                                onChange={(e) => setEditForm({...editForm, artist: e.target.value})}
                                className="text-xl font-bold bg-white/10 p-2 rounded focus:outline-none focus:ring-2 focus:ring-white"
                                placeholder="Artist Name"
                            />
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleSave} className="bg-green-500 text-black px-4 py-1 rounded-full font-bold text-sm">Save</button>
                                <button onClick={() => setIsEditing(false)} className="border border-white/30 text-white px-4 py-1 rounded-full font-bold text-sm hover:border-white">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-5xl md:text-8xl font-black tracking-tight leading-none mb-4 truncate">{album.name}</h1>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <span className="font-bold hover:underline cursor-pointer">{album.artist}</span>
                                <span className="text-white/70">• {new Date().getFullYear()} • {album.track_count} songs, <span className="text-white/50">{Math.floor(album.total_duration / 60)} min {Math.floor(album.total_duration % 60)} sec</span></span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="px-8 py-6 bg-gradient-to-b from-[#121212]/30 to-[#121212] flex items-center gap-8">
                <button
                    onClick={handlePlayAlbum}
                    className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg text-black"
                >
                    {isPlayingThisAlbum ? <FaPause size={24} /> : <FaPlay size={24} className="ml-1" />}
                </button>
                
                <button className="text-[#b3b3b3] hover:text-white transition-colors">
                    <FaHeart size={32} />
                </button>

                {isOwner && !isEditing && (
                    <div className="ml-auto flex gap-4 items-center">
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="text-gray-400 hover:text-white p-2"
                            title="Edit Album"
                        >
                            <FaEdit size={24} />
                        </button>
                        <button 
                            onClick={handleDelete}
                            className="text-gray-400 hover:text-red-500 p-2"
                            title="Delete Album"
                        >
                            <FaTrash size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Tracks */}
            <div className="px-8">
                <TrackList
                    tracks={album.tracks}
                    onPlay={onPlay}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onTogglePlay={onTogglePlay}
                    hideAlbumColumn={true}
                    allowManage={isOwner}
                />
            </div>
        </div>
    );
};

export default AlbumDetails;