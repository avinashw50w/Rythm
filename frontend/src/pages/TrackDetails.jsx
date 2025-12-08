import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { FaPlay, FaPause, FaEdit, FaSave, FaTimes, FaMusic, FaGlobe, FaLock, FaCamera, FaTrash, FaHeart } from 'react-icons/fa';

const TrackDetails = ({ onPlay, currentTrack, isPlaying, onTogglePlay, onUpdateTrack }) => {
    const { trackId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast, confirmAction } = useUI();
    const [track, setTrack] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        artist: '',
        album: '',
        genre: ''
    });

    const fetchTrack = async () => {
        try {
            const res = await client.get(`/tracks/${trackId}`);
            setTrack(res.data);
            setEditForm({
                title: res.data.title || '',
                artist: res.data.artist || '',
                album: res.data.album || '',
                genre: res.data.genre || ''
            });
        } catch (error) {
            console.error('Error fetching track:', error);
            if (error.response && error.response.status === 404) {
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrack();
    }, [trackId, navigate]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        
        setSaving(true);
        try {
            const res = await client.put(`/tracks/${trackId}`, editForm);
            setTrack(prev => ({ ...prev, ...res.data }));
            setIsEditing(false);
            showToast('Track updated successfully', 'success');
            
            if (onUpdateTrack) {
                onUpdateTrack(res.data);
            }
        } catch (error) {
            console.error('Error updating track:', error);
            showToast('Failed to update track', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleThumbnailUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await client.post(`/tracks/${trackId}/thumbnail`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setTrack(prev => ({ ...prev, album_art_path: res.data.album_art_path }));
            
            if (onUpdateTrack) {
                onUpdateTrack({ ...track, album_art_path: res.data.album_art_path });
            }
            showToast('Thumbnail uploaded', 'success');
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
            showToast('Failed to upload thumbnail', 'error');
        }
    };

    const togglePublish = async () => {
        const newStatus = !track.is_public;
        const action = newStatus ? 'publish' : 'unpublish';

        confirmAction(`Are you sure you want to ${action} this track?`, async () => {
            try {
                await client.put(`/tracks/${trackId}/publish?publish=${newStatus}`);
                setTrack(prev => ({ ...prev, is_public: newStatus }));
                if (onUpdateTrack) {
                    onUpdateTrack({ ...track, is_public: newStatus });
                }
                showToast(`Track ${action}ed`, 'success');
            } catch (error) {
                console.error('Error updating publish status:', error);
                showToast('Failed to update publish status', 'error');
            }
        }, `Confirm ${action}`);
    };

    const handleDelete = async () => {
        confirmAction(`Are you sure you want to delete "${track.title}"? This cannot be undone.`, async () => {
            try {
                await client.delete(`/tracks/${trackId}`);
                navigate('/profile');
                showToast('Track deleted', 'success');
            } catch (error) {
                console.error('Error deleting track:', error);
                showToast('Failed to delete track', 'error');
            }
        }, 'Delete Track');
    };

    const handlePlay = () => {
        if (currentTrack?.id === track.id) {
            onTogglePlay();
        } else {
            // When playing from detail view, queue only this track
            onPlay(track, [track]);
        }
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!track) return null;

    const isOwner = user && user.id === track.uploader_id;
    const isCurrentTrack = currentTrack?.id === track.id;

    // Gradient background based on a static color for now (simulating extraction from album art)
    const bgColor = 'from-[#535353]';

    return (
        <div className="text-white pb-32">
            {/* Header Section */}
            <div className={`flex flex-col md:flex-row gap-8 p-8 pt-24 bg-gradient-to-b ${bgColor} to-[#121212] items-end`}>
                {/* Album Art */}
                <div className="w-64 h-64 flex-shrink-0 bg-[#282828] shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden relative group rounded-sm">
                    {track.album_art_path ? (
                        <img src={`http://localhost:8000/${track.album_art_path}`} alt={track.album} className="w-full h-full object-cover" />
                    ) : (
                        <FaMusic size={80} className="text-gray-600" />
                    )}

                    {/* Overlay with play button and optional upload for owners */}
                    {isOwner && (
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <FaCamera className="text-white text-3xl" />
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleThumbnailUpload}
                            />
                        </label>
                    )}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-2 flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="uppercase text-xs font-bold tracking-wider text-white">Song</span>
                        {track.is_public ? (
                            <FaGlobe className="text-white/70 text-xs" title="Public" />
                        ) : (
                            <FaLock className="text-white/70 text-xs" title="Private" />
                        )}
                    </div>

                    {isEditing ? (
                        <div className="space-y-4 mb-4 bg-black/40 backdrop-blur-md p-6 rounded-lg border border-white/10 max-w-2xl">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full bg-transparent border-b border-white/50 text-white px-0 py-2 text-2xl font-bold focus:outline-none focus:border-green-500 placeholder-gray-600"
                                    placeholder="Title"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Artist</label>
                                    <input
                                        type="text"
                                        value={editForm.artist}
                                        onChange={e => setEditForm({ ...editForm, artist: e.target.value })}
                                        className="w-full bg-white/10 text-white px-3 py-2 rounded focus:outline-none placeholder-gray-500"
                                        placeholder="Artist"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Album</label>
                                    <input
                                        type="text"
                                        value={editForm.album}
                                        onChange={e => setEditForm({ ...editForm, album: e.target.value })}
                                        className="w-full bg-white/10 text-white px-3 py-2 rounded focus:outline-none placeholder-gray-500"
                                        placeholder="Album"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Genre</label>
                                    <input
                                        type="text"
                                        value={editForm.genre}
                                        onChange={e => setEditForm({ ...editForm, genre: e.target.value })}
                                        className="w-full bg-white/10 text-white px-3 py-2 rounded focus:outline-none placeholder-gray-500"
                                        placeholder="Genre"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={handleSave} 
                                    disabled={saving} 
                                    className="bg-green-500 text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2"
                                >
                                    <FaSave /> {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button type="button" onClick={() => setIsEditing(false)} className="bg-transparent border border-white/50 text-white px-6 py-2 rounded-full font-bold hover:border-white transition-colors flex items-center gap-2">
                                    <FaTimes /> Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-4xl md:text-7xl font-black mb-4 leading-none tracking-tight">{track.title}</h1>
                            <div className="flex items-center gap-2 text-white font-medium text-sm md:text-base">
                                {user && user.avatar_url && <img src={user.avatar_url} className="w-6 h-6 rounded-full" />}
                                {track.artist && (
                                    <>
                                        <Link to={`/artist/${track.artist_id}`} className="hover:underline font-bold">{track.artist}</Link>
                                        <span>•</span>
                                    </>
                                )}
                                {track.album && (
                                    <>
                                        <Link to={`/album/${track.album_id}`} className="hover:underline">{track.album}</Link>
                                        <span>•</span>
                                    </>
                                )}
                                {track.created_at && (
                                    <>
                                        <span>{new Date(track.created_at).getFullYear()}</span>
                                        <span>•</span>
                                    </>
                                )}
                                <span>{Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, '0')}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="px-8 py-6 bg-gradient-to-b from-[#121212]/30 to-[#121212] flex items-center gap-8 mb-8">
                <button
                    onClick={handlePlay}
                    className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg text-black"
                >
                    {isCurrentTrack && isPlaying ? <FaPause size={24} /> : <FaPlay size={24} className="ml-1" />}
                </button>
                
                <button className={`text-[#b3b3b3] hover:text-white transition-colors ${track.is_favorite ? 'text-[#1ed760]' : ''}`}>
                    <FaHeart size={32} />
                </button>

                {isOwner && !isEditing && (
                    <div className="ml-auto flex items-center gap-4">
                        <button
                            onClick={togglePublish}
                            className="text-gray-400 hover:text-white"
                            title={track.is_public ? 'Make Private' : 'Publish'}
                        >
                            {track.is_public ? <FaGlobe size={20} /> : <FaLock size={20} />}
                        </button>
                        <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-white">
                            <FaEdit size={20} />
                        </button>
                        <button onClick={handleDelete} className="text-gray-400 hover:text-red-500">
                            <FaTrash size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Lyrics & Credits Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 px-8">
                {/* Lyrics Placeholder */}
                <div>
                    <h2 className="text-2xl font-bold mb-4">Lyrics</h2>
                    <div className="bg-[#2a2a2a] p-8 rounded-lg text-gray-400 text-lg leading-loose min-h-[400px]">
                        <p>Lyrics are not available for this track yet.</p>
                        <p className="mt-4 italic opacity-50">Imagine the words here...</p>
                    </div>
                </div>

                {/* Credits */}
                <div>
                    <h2 className="text-2xl font-bold mb-4">Credits</h2>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between group cursor-pointer hover:bg-[#2a2a2a] p-2 rounded -mx-2 transition-colors">
                            <div>
                                <h3 className="text-white font-bold">{track.artist}</h3>
                                <p className="text-sm text-gray-400">Main Artist</p>
                            </div>
                            <button className="border border-gray-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Follow</button>
                        </div>
                        
                        <div className="flex items-center justify-between hover:bg-[#2a2a2a] p-2 rounded -mx-2 transition-colors">
                            <div>
                                <h3 className="text-white font-bold">{track.uploader_name}</h3>
                                <p className="text-sm text-gray-400">Uploaded By</p>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-800">
                            <h3 className="text-white font-bold mb-2">Technical Info</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                                <div>
                                    <span className="block text-gray-500 text-xs">Bitrate</span>
                                    {track.bitrate}
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs">Size</span>
                                    {(track.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs">Format</span>
                                    MP3
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackDetails;