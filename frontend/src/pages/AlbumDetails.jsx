import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import TrackList from '../components/TrackList';
import { FaPlay, FaPause, FaEdit, FaSave, FaTimes, FaMusic, FaGlobe, FaLock, FaTrash } from 'react-icons/fa';

const AlbumDetails = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { albumName } = useParams(); // Note: Encoded in URL
    const navigate = useNavigate();
    const { user } = useAuth();
    const [album, setAlbum] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        new_name: '',
        artist: '',
        genre: ''
    });

    useEffect(() => {
        fetchAlbum();
    }, [albumName]);

    const fetchAlbum = async () => {
        try {
            // albumName might contain spaces or special chars
            const res = await client.get(`/albums/${encodeURIComponent(albumName)}`);
            setAlbum(res.data);
            setEditForm({
                new_name: res.data.name,
                artist: res.data.artist || '',
                genre: '' // Not returned by default aggregate, nice to have though
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

    const handleSave = async () => {
        try {
            const res = await client.put(`/albums/${encodeURIComponent(albumName)}`, editForm);
            // If name changed, we should navigate to new URL
            if (editForm.new_name !== albumName) {
                navigate(`/album/${encodeURIComponent(editForm.new_name)}`);
            } else {
                fetchAlbum(); // Refresh data
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Error updating album:', error);
            alert('Failed to update album');
        }
    };

    // Derived state for owner and public status
    const isOwner = album?.is_owner;
    const isPublic = album?.tracks.length > 0 && album.tracks[0].is_public;

    const togglePublish = async () => {
        if (!album || !album.tracks.length) return;
        const newStatus = !isPublic;
        const action = newStatus ? "publish" : "unpublish";

        if (!window.confirm(`Are you sure you want to ${action} this album?`)) {
            return;
        }

        try {
            await client.put(`/albums/${encodeURIComponent(albumName)}/publish`, { is_public: newStatus });
            fetchAlbum();
        } catch (error) {
            console.error('Error publishing album:', error);
        }
    };

    const handleDeleteAlbum = async () => {
        if (!window.confirm(`Are you sure you want to delete the album "${album.name}"? This will delete ALL tracks in it. This cannot be undone.`)) {
            return;
        }

        try {
            await client.delete(`/albums/${encodeURIComponent(albumName)}`);
            navigate('/profile');
        } catch (error) {
            console.error("Error deleting album:", error);
            alert("Failed to delete album");
        }
    };

    const handlePlayAlbum = () => {
        // If current track is from this album and playing, toggle pause
        // Since we don't have "context" (playlist) ID fully implemented in player,
        // we check if current track is in this album's track list.
        if (currentTrack && album.tracks.some(t => t.id === currentTrack.id)) {
            onTogglePlay();
            return;
        }

        if (album && album.tracks.length > 0) {
            onPlay(album.tracks[0]);
        }
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!album) return <div className="text-white p-8">Album not found</div>;

    // Check if any track from this album is currently playing
    const isPlayingThisAlbum = isPlaying && currentTrack && album.tracks.some(t => t.id === currentTrack.id);

    return (
        <div className="text-white p-8 pb-32 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-8 mb-8 items-end bg-gradient-to-b from-[#2e2e2e] to-[#121212] p-8 rounded-lg">
                <div className="w-52 h-52 bg-[#282828] shadow-2xl flex items-center justify-center flex-shrink-0">
                    {album.album_art_path ? (
                        <img src={`http://localhost:8000/${album.album_art_path}`} className="w-full h-full object-cover shadow-lg" />
                    ) : (
                        <FaMusic size={64} className="text-gray-500" />
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
                                <button onClick={handleSave} className="bg-green-500 text-black px-4 py-1 rounded font-bold text-sm">Save</button>
                                <button onClick={() => setIsEditing(false)} className="border border-gray-500 text-white px-4 py-1 rounded font-bold text-sm">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <h1 className="text-3xl md:text-5xl font-black truncate leading-tight py-2">{album.name}</h1>
                    )}

                    <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mt-2">
                        {album.artist && <span className="text-white font-bold hover:underline cursor-pointer">{album.artist}</span>}
                        <span>•</span>
                        <span>{new Date().getFullYear()}</span> {/* Year placeholder since we lack album year */}
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
