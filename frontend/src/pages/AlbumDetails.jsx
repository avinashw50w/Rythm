import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import TrackList from '../components/TrackList';
import { FaPlay, FaPause, FaEdit, FaSave, FaTimes, FaMusic, FaGlobe, FaLock, FaTrash, FaCamera } from 'react-icons/fa';

const AlbumDetails = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { albumId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast, confirmAction } = useUI();
    const [album, setAlbum] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        new_name: '',
        artist: '',
        genre: ''
    });

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
                genre: '' 
            });
        } catch (error) {
            console.error('Error fetching album:', error);
            if (error.response && error.response.status === 404) {
                // navigate('/'); // Optional: redirect if not found
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        if(e) e.preventDefault();
        setSaving(true);
        try {
            const res = await client.put(`/albums/${albumId}`, editForm);
            setIsEditing(false); // Close immediately
            
            // If name changed, updating local state is enough since ID is persistent
            setAlbum(prev => ({ ...prev, name: editForm.new_name, artist: editForm.artist }));
            showToast('Album updated successfully', 'success');
        } catch (error) {
            console.error('Error updating album:', error);
            showToast('Failed to update album', 'error');
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
            const res = await client.post(`/tracks/album/${albumId}/thumbnail`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAlbum(prev => ({ ...prev, album_art_path: res.data.album_art_path }));
            showToast('Album art updated', 'success');
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
            showToast('Failed to upload thumbnail', 'error');
        }
    };

    // Derived state for owner and public status
    const isOwner = album?.is_owner;
    const isPublic = album?.tracks.length > 0 && album.tracks[0].is_public;

    const togglePublish = async () => {
        if (!album || !album.tracks.length) return;
        const newStatus = !isPublic;
        const action = newStatus ? "publish" : "unpublish";

        confirmAction(`Are you sure you want to ${action} this album?`, async () => {
            try {
                await client.put(`/albums/${albumId}/publish`, { is_public: newStatus });
                // Update local state
                setAlbum(prev => ({
                    ...prev,
                    tracks: prev.tracks.map(t => ({ ...t, is_public: newStatus }))
                }));
                showToast(`Album ${action}ed`, 'success');
            } catch (error) {
                console.error('Error publishing album:', error);
                showToast('Error updating status', 'error');
            }
        }, `Confirm ${action}`);
    };

    const handleDeleteAlbum = async () => {
        confirmAction(`Are you sure you want to delete the album "${album.name}"? This will delete ALL tracks in it. This cannot be undone.`, async () => {
            try {
                await client.delete(`/albums/${albumId}`);
                navigate('/profile');
                showToast('Album deleted', 'success');
            } catch (error) {
                console.error("Error deleting album:", error);
                showToast("Failed to delete album", 'error');
            }
        }, 'Delete Album');
    };

    const handlePlayAlbum = () => {
        if (currentTrack && album.tracks.some(t => t.id === currentTrack.id)) {
            onTogglePlay();
            return;
        }

        if (album && album.tracks.length > 0) {
            // Queue entire album
            onPlay(album.tracks[0], album.tracks);
        }
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!album) return <div className="text-white p-8">Album not found</div>;

    const isPlayingThisAlbum = isPlaying && currentTrack && album.tracks.some(t => t.id === currentTrack.id);

    return (
        <div className="text-white p-8 pb-32 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-8 mb-8 items-end bg-gradient-to-b from-[#2e2e2e] to-[#121212] p-8 rounded-lg">
                <div className="relative w-52 h-52 bg-[#282828] shadow-2xl flex items-center justify-center flex-shrink-0 overflow-hidden rounded-md group">
                    {album.album_art_path ? (
                        <img src={`http://localhost:8000/${album.album_art_path}`} className="w-full h-full object-cover shadow-lg" />
                    ) : (
                        <FaMusic size={64} className="text-gray-500" />
                    )}
                    {isOwner && (
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <div className="text-center">
                                <FaCamera size={24} className="mx-auto mb-2" />
                                <span className="text-sm font-bold">Change Image</span>
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

                <div className="flex flex-col gap-2 flex-grow min-w-0">
                    <span className="uppercase text-xs font-bold tracking-wider text-gray-400">Album</span>

                    {isEditing ? (
                        <div className="bg-[#282828] p-4 rounded-lg border border-gray-600 space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Album Name</label>
                                <input
                                    className="bg-[#3e3e3e] text-white px-3 py-2 rounded w-full text-2xl font-bold"
                                    value={editForm.new_name}
                                    onChange={e => setEditForm({ ...editForm, new_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Artist (Batch Update)</label>
                                <input
                                    className="bg-[#3e3e3e] text-white px-3 py-2 rounded w-full"
                                    value={editForm.artist}
                                    onChange={e => setEditForm({ ...editForm, artist: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={handleSave} disabled={saving} className="bg-green-500 text-black px-4 py-1 rounded font-bold text-sm disabled:opacity-50">
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button type="button" onClick={() => setIsEditing(false)} className="border border-gray-500 text-white px-4 py-1 rounded font-bold text-sm">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <h1 className="text-3xl md:text-5xl font-black truncate leading-tight py-2">{album.name}</h1>
                    )}

                    <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mt-2">
                        {album.artist && (
                            <>
                                <Link to={`/artist/${album.artist_id}`} className="text-white font-bold hover:underline cursor-pointer">{album.artist}</Link>
                                <span>•</span>
                            </>
                        )}
                        <span>{new Date().getFullYear()}</span>
                        <span>•</span>
                        <span>{album.track_count} songs,</span>
                        <span className="text-gray-400">
                            {Math.floor(album.total_duration / 60)} min {Math.floor(album.total_duration % 60)} sec
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-8 mb-8 px-4">
                <button
                    onClick={handlePlayAlbum}
                    className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg text-black"
                >
                    {isPlayingThisAlbum ? <FaPause size={24} className="ml-1" /> : <FaPlay size={24} className="ml-1" />}
                </button>

                {isOwner && (
                    <>
                        <button
                            onClick={togglePublish}
                            className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full border ${isPublic ? 'border-green-500 text-green-500' : 'border-gray-500 text-gray-400'}`}
                        >
                            {isPublic ? (
                                <>
                                    <FaGlobe /> Published
                                </>
                            ) : (
                                <>
                                    <FaLock /> Private
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-gray-400 hover:text-white"
                            title="Edit Album"
                        >
                            <FaEdit size={24} />
                        </button>

                        <button
                            onClick={handleDeleteAlbum}
                            className="text-gray-400 hover:text-red-500"
                            title="Delete Album"
                        >
                            <FaTrash size={24} />
                        </button>
                    </>
                )}
            </div>

            {/* Tracks */}
            <div className="px-4">
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