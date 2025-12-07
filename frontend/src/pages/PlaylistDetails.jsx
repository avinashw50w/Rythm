import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import TrackList from '../components/TrackList';
import { FaMusic, FaPlay, FaPause, FaGlobe, FaLock, FaEdit, FaTrash, FaCamera } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const PlaylistDetails = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { playlistId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [playlist, setPlaylist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        fetchPlaylist();
    }, [playlistId]);

    const fetchPlaylist = async () => {
        try {
            const res = await client.get(`/playlists/${playlistId}`);
            setPlaylist(res.data);
            setEditName(res.data.name);
        } catch (error) {
            console.error("Error fetching playlist:", error);
        } finally {
            setLoading(false);
        }
    };

    const isOwner = user && playlist && user.id === playlist.creator_id;

    const handlePlayAll = () => {
        if (currentTrack && playlist.tracks.some(t => t.id === currentTrack.id)) {
            onTogglePlay();
            return;
        }
        if (playlist && playlist.tracks.length > 0) {
            onPlay(playlist.tracks[0]);
        }
    };

    const isPlayingThisPlaylist = isPlaying && currentTrack && playlist?.tracks.some(t => t.id === currentTrack.id);

    const togglePublish = async () => {
        const action = playlist.is_public ? "make private" : "make public";
        if (!window.confirm(`Are you sure you want to ${action} this playlist?`)) return;

        try {
            await client.put(`/playlists/${playlistId}?is_public=${!playlist.is_public}`);
            setPlaylist(prev => ({ ...prev, is_public: !prev.is_public }));
        } catch (error) {
            console.error("Error updating playlist:", error);
            alert("Failed to update playlist");
        }
    };

    const handleSave = async () => {
        try {
            await client.put(`/playlists/${playlistId}?name=${encodeURIComponent(editName)}`);
            setPlaylist(prev => ({ ...prev, name: editName }));
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating playlist:", error);
            alert("Failed to update playlist");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this playlist? This cannot be undone.")) return;

        try {
            await client.delete(`/playlists/${playlistId}`);
            navigate('/');
        } catch (error) {
            console.error("Error deleting playlist:", error);
            alert("Failed to delete playlist");
        }
    };

    const handleThumbnailUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await client.post(`/playlists/${playlistId}/thumbnail`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPlaylist(prev => ({ ...prev, thumbnail_path: res.data.thumbnail_path }));
        } catch (error) {
            console.error("Error uploading thumbnail:", error);
            alert("Failed to upload thumbnail");
        }
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!playlist) return <div className="text-white p-8">Playlist not found</div>;

    return (
        <div className="text-white pb-32 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-8 mb-8 items-end bg-gradient-to-b from-[#4a3090] to-[#121212] p-8 rounded-lg">
                <div className="relative w-52 h-52 bg-gradient-to-br from-[#282828] to-[#181818] shadow-2xl flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden group">
                    {playlist.thumbnail_path ? (
                        <img src={`http://localhost:8000/${playlist.thumbnail_path}`} alt="" className="w-full h-full object-cover" />
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
                    <span className="uppercase text-xs font-bold tracking-wider text-gray-400">Playlist</span>

                    {isEditing ? (
                        <div className="flex gap-2 items-center">
                            <input
                                className="bg-[#3e3e3e] text-white px-3 py-2 rounded text-2xl font-bold flex-grow"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                            />
                            <button onClick={handleSave} className="bg-green-500 text-black px-4 py-2 rounded font-bold">Save</button>
                            <button onClick={() => setIsEditing(false)} className="border border-gray-500 text-white px-4 py-2 rounded">Cancel</button>
                        </div>
                    ) : (
                        <h1 className="text-3xl md:text-5xl font-black truncate leading-tight py-2">{playlist.name}</h1>
                    )}

                    <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mt-2">
                        <span className="text-white font-bold">{playlist.creator_name}</span>
                        <span>•</span>
                        <span>{playlist.track_count} songs</span>
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-8 mb-8 px-4">
                <button
                    onClick={handlePlayAll}
                    className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg text-black"
                    disabled={playlist.tracks.length === 0}
                >
                    {isPlayingThisPlaylist ? <FaPause size={24} className="ml-1" /> : <FaPlay size={24} className="ml-1" />}
                </button>

                {isOwner && (
                    <>
                        <button
                            onClick={togglePublish}
                            className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full border ${playlist.is_public ? 'border-green-500 text-green-500' : 'border-gray-500 text-gray-400'}`}
                        >
                            {playlist.is_public ? <><FaGlobe /> Public</> : <><FaLock /> Private</>}
                        </button>

                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-gray-400 hover:text-white"
                            title="Edit Playlist"
                        >
                            <FaEdit size={24} />
                        </button>

                        <button
                            onClick={handleDelete}
                            className="text-gray-400 hover:text-red-500"
                            title="Delete Playlist"
                        >
                            <FaTrash size={24} />
                        </button>
                    </>
                )}
            </div>

            {/* Tracks */}
            <div className="px-4">
                {playlist.tracks.length > 0 ? (
                    <TrackList
                        tracks={playlist.tracks}
                        onPlay={onPlay}
                        currentTrack={currentTrack}
                        isPlaying={isPlaying}
                        onTogglePlay={onTogglePlay}
                    />
                ) : (
                    <div className="text-gray-400 text-center py-12">
                        <FaMusic size={48} className="mx-auto mb-4 opacity-50" />
                        <p>This playlist is empty</p>
                        <p className="text-sm mt-2">Add songs using the menu on any track</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaylistDetails;
