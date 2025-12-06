import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaPause, FaClock, FaHeart, FaRegHeart, FaGlobe, FaLock, FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const TrackList = ({ tracks, onPlay, currentTrack, isPlaying, onTogglePlay, hideAlbumColumn = false, allowManage = false }) => {
    const { user } = useAuth();
    const [localTracks, setLocalTracks] = useState(tracks);
    // Update local state when props change
    useEffect(() => {
        setLocalTracks(tracks);
    }, [tracks]);

    useEffect(() => {
    }, [localTracks]);

    const handlePlayClick = (e, track) => {
        e.stopPropagation();
        if (currentTrack && currentTrack.id === track.id) {
            onTogglePlay();
        } else {
            onPlay(track);
        }
    };

    const handlePublish = async (e, track) => {
        e.stopPropagation();

        const action = track.is_public ? "unpublish" : "publish";
        if (!window.confirm(`Are you sure you want to ${action} "${track.title}" ? `)) {
            return;
        }

        try {
            const newStatus = !track.is_public;
            await client.put(`/tracks/${track.id}/publish?publish=${newStatus}`);

            // Update local state to reflect change immediately
            setLocalTracks(prev => prev.map(t =>
                t.id === track.id ? { ...t, is_public: newStatus } : t
            ));
        } catch (error) {
            console.error("Error updating publish status:", error);
            alert("Failed to update publish status");
        }
    };

    const handleDelete = async (e, track) => {
        e.stopPropagation();

        if (!window.confirm(`Are you sure you want to delete "${track.title}"? This cannot be undone.`)) {
            return;
        }

        try {
            await client.delete(`/tracks/${track.id}`);
            // Remove from list
            setLocalTracks(prev => prev.filter(t => t.id !== track.id));
        } catch (error) {
            console.error("Error deleting track:", error);
            alert("Failed to delete track");
        }
    };

    const handleFavorite = async (e, track) => {
        e.stopPropagation();
        if (!user) return; // Should probably prompt login, but for now just return

        try {
            const res = await client.post(`/users/favorites/${track.id}`);
            // Update local state
            setLocalTracks(prev => prev.map(t =>
                t.id === track.id ? { ...t, is_favorite: res.data.is_favorite } : t
            ));
        } catch (error) {
            console.error("Error toggling favorite:", error);
        }
    };

    const gridCols = hideAlbumColumn
        ? "grid-cols-[16px_4fr_2fr_minmax(120px,1fr)]"
        : "grid-cols-[16px_4fr_3fr_2fr_minmax(120px,1fr)]";

    return (
        <div className="flex flex-col">
            {/* Header */}
            <div className={`grid ${gridCols} gap-4 px-4 py-2 border-b border-[#282828] text-sm text-[#b3b3b3] sticky top-0 bg-[#121212] z-10 font-bold uppercase`}>
                <span>#</span>
                <span>Title</span>
                {!hideAlbumColumn && <span>Album</span>}
                <span>Date Added</span>
                <span className="flex justify-end"><FaClock /></span>
            </div>

            {/* Tracks */}
            <div className="mt-2">
                {localTracks.map((track, index) => {
                    const isCurrent = currentTrack && currentTrack.id === track.id;
                    return (
                        <div
                            key={track.id}
                            className={`grid ${gridCols} gap-4 px-4 py-3 hover:bg-[#2a2a2a] rounded-md group transition-colors cursor-pointer items-center ${isCurrent ? 'bg-[#2a2a2a]' : ''}`}
                            onClick={(e) => handlePlayClick(e, track)}
                        >
                            <div className="text-[#b3b3b3] text-sm group-hover:hidden">
                                {isCurrent && isPlaying ? (
                                    // <span className="text-green-500 animate-pulse">Running</span> // Or a mini text/icon
                                    <FaPause size={10} />
                                ) : (
                                    index + 1
                                )}
                            </div>
                            <div className={`hidden group-hover:block ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                                {isCurrent && isPlaying ? <FaPause size={10} /> : <FaPlay size={10} />}
                            </div>

                            <div className="flex items-center gap-4 overflow-hidden">
                                {track.album_art_path ? (
                                    <img src={`http://localhost:8000/${track.album_art_path}`} alt="" className="w-10 h-10 rounded shadow-sm object-cover" />
                                ) : (
                                    <div className="w-10 h-10 bg-[#282828] rounded flex items-center justify-center text-xs text-gray-500">
                                        <span className="font-bold">♪</span>
                                    </div>
                                )}
                                <div className="flex flex-col overflow-hidden">
                                    <span className={`font-medium truncate hover:underline ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                                        {track.title}
                                    </span>
                                    <span className="text-sm text-[#b3b3b3] truncate group-hover:text-white transition-colors">{track.artist}</span>
                                </div>
                            </div>

                            {!hideAlbumColumn && (
                                <div className="text-[#b3b3b3] text-sm truncate group-hover:text-white transition-colors hover:underline">
                                    <Link to={`/album/${encodeURIComponent(track.album)}`} onClick={(e) => e.stopPropagation()}>
                                        {track.album || 'Unknown Album'}
                                    </Link>
                                </div>
                            )}

                            <div className="text-[#b3b3b3] text-sm truncate">2 days ago</div> {/* Placeholder for date added */}

                            <div className="flex items-center justify-end gap-4 text-[#b3b3b3] text-sm">
                                {/* Publish & Delete Buttons (Only for owner AND explicitly allowed) */}
                                {user && track.uploader_name === user.name && allowManage && (
                                    <>
                                        <button
                                            onClick={(e) => handlePublish(e, track)}
                                            className={`hover:text-white transition-opacity ${track.is_public ? 'text-green-500' : 'text-gray-500'}`}
                                            title={track.is_public ? "Public (Click to unpublish)" : "Private (Click to publish)"}
                                        >
                                            {track.is_public ? <FaGlobe /> : <FaLock />}
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, track)}
                                            className="text-gray-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Track"
                                        >
                                            <FaTrash />
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={(e) => handleFavorite(e, track)}
                                    className={`hover:text-white transition-opacity ${track.is_favorite ? 'opacity-100 text-green-500' : 'opacity-0 group-hover:opacity-100'}`}
                                    title={track.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                                >
                                    {track.is_favorite ? <FaHeart /> : <FaRegHeart />}
                                </button>
                                <span>{track.duration ? `${Math.floor(track.duration / 60)}:${('0' + Math.floor(track.duration % 60)).slice(-2)}` : '--:--'}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default TrackList;
