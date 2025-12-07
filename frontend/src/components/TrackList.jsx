import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaPause, FaClock, FaHeart, FaRegHeart, FaGlobe, FaLock, FaTrash, FaPlus } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import client from '../api/client';

const TrackList = ({ tracks, onPlay, currentTrack, isPlaying, onTogglePlay, hideAlbumColumn = false, allowManage = false }) => {
    const { user } = useAuth();
    const { showToast, confirmAction } = useUI();
    const [localTracks, setLocalTracks] = useState(tracks);
    const [playlists, setPlaylists] = useState([]);
    const [openMenuTrackId, setOpenMenuTrackId] = useState(null);

    // Update local state when props change
    useEffect(() => {
        setLocalTracks(tracks);
    }, [tracks]);

    useEffect(() => {
        if (user) {
            fetchPlaylists();
        }
    }, [user]);

    const fetchPlaylists = async () => {
        try {
            const res = await client.get('/playlists/');
            setPlaylists(res.data);
        } catch (error) {
            console.error('Error fetching playlists:', error);
        }
    };

    const handleAddToPlaylist = async (e, trackId, playlistId) => {
        e.stopPropagation();
        try {
            await client.post(`/playlists/${playlistId}/tracks/${trackId}`);
            setOpenMenuTrackId(null);
            showToast('Track added to playlist!', 'success');
        } catch (error) {
            if (error.response?.status === 400) {
                showToast('Track already in playlist', 'info');
            } else {
                showToast('Failed to add track to playlist', 'error');
            }
        }
    };

    const handlePlayClick = (e, track) => {
        e.stopPropagation();
        if (currentTrack && currentTrack.id === track.id) {
            onTogglePlay();
        } else {
            // Pass the full list of tracks to enable queueing
            onPlay(track, localTracks);
        }
    };

    const handlePublish = async (e, track) => {
        e.stopPropagation();

        const action = track.is_public ? "unpublish" : "publish";
        
        confirmAction(`Are you sure you want to ${action} "${track.title}"?`, async () => {
            try {
                const newStatus = !track.is_public;
                await client.put(`/tracks/${track.id}/publish?publish=${newStatus}`);

                // Update local state to reflect change immediately
                setLocalTracks(prev => prev.map(t =>
                    t.id === track.id ? { ...t, is_public: newStatus } : t
                ));
                showToast(`Track ${action}ed successfully`, 'success');
            } catch (error) {
                console.error("Error updating publish status:", error);
                showToast("Failed to update publish status", 'error');
            }
        }, `Confirm ${action}`);
    };

    const handleFavorite = async (e, track) => {
        e.stopPropagation();
        if (!user) {
            showToast('Please log in to like songs', 'info');
            return;
        }

        try {
            const res = await client.post(`/users/favorites/${track.id}`);
            // Update local state
            setLocalTracks(prev => prev.map(t =>
                t.id === track.id ? { ...t, is_favorite: res.data.is_favorite } : t
            ));
            showToast(res.data.is_favorite ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'success');
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
            <div className={`grid ${gridCols} gap-4 px-4 py-2 border-b border-[#282828] text-sm text-[#b3b3b3] bg-[#121212] font-bold uppercase`}>
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
                                    <img src={`http://localhost:8000/${track.album_art_path}`} alt="" className="w-10 h-10 flex-shrink-0 rounded shadow-sm object-cover" />
                                ) : (
                                    <div className="w-10 h-10 flex-shrink-0 bg-[#282828] rounded flex items-center justify-center text-xs text-gray-500">
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
                                {/* Publish Button (Only for owner AND explicitly allowed) */}
                                {user && track.uploader_name === user.name && allowManage && (
                                    <button
                                        onClick={(e) => handlePublish(e, track)}
                                        className={`hover:text-white transition-opacity ${track.is_public ? 'text-green-500' : 'text-gray-500'}`}
                                        title={track.is_public ? "Public (Click to unpublish)" : "Private (Click to publish)"}
                                    >
                                        {track.is_public ? <FaGlobe /> : <FaLock />}
                                    </button>
                                )}

                                <button
                                    onClick={(e) => handleFavorite(e, track)}
                                    className={`hover:text-white transition-opacity ${track.is_favorite ? 'opacity-100 text-green-500' : 'opacity-0 group-hover:opacity-100'}`}
                                    title={track.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                                >
                                    {track.is_favorite ? <FaHeart /> : <FaRegHeart />}
                                </button>

                                {/* Add to Playlist Menu */}
                                {user && (
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuTrackId(openMenuTrackId === track.id ? null : track.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
                                            title="Add to Playlist"
                                        >
                                            <FaPlus />
                                        </button>
                                        {openMenuTrackId === track.id && (
                                            <div className="absolute right-0 bottom-full mb-2 bg-[#282828] rounded-lg shadow-xl z-50 min-w-[200px] py-2 border border-[#333]">
                                                <div className="px-4 py-2 text-xs text-gray-400 uppercase font-bold border-b border-[#333]">Add to Playlist</div>
                                                {playlists.length > 0 ? (
                                                    playlists.map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={(e) => handleAddToPlaylist(e, track.id, p.id)}
                                                            className="w-full text-left px-4 py-2 hover:bg-[#3e3e3e] text-sm text-white transition-colors"
                                                        >
                                                            {p.name}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-2 text-sm text-gray-500">No playlists yet</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

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