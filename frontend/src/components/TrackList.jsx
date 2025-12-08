import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaPause, FaClock, FaHeart, FaRegHeart, FaGlobe, FaLock, FaPlus } from 'react-icons/fa';
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

    const handlePublish = async (e, track) => {
        e.stopPropagation();
        const action = track.is_public ? "unpublish" : "publish";
        confirmAction(`Are you sure you want to ${action} "${track.title}"?`, async () => {
            try {
                const newStatus = !track.is_public;
                await client.put(`/tracks/${track.id}/publish?publish=${newStatus}`);
                setLocalTracks(prev => prev.map(t => t.id === track.id ? { ...t, is_public: newStatus } : t));
                showToast(`Track ${action}ed successfully`, 'success');
            } catch (error) {
                console.error("Error updating publish status:", error);
                showToast("Failed to update publish status", 'error');
            }
        }, `Confirm ${action}`);
    };

    const gridCols = hideAlbumColumn
        ? "grid-cols-[40px_minmax(0,1fr)_120px]"
        : "grid-cols-[40px_minmax(0,4fr)_minmax(0,3fr)_120px]";

    return (
        <div className="flex flex-col w-full">
            {/* Header */}
            <div className={`grid ${gridCols} gap-4 px-4 py-2 text-xs font-medium text-[#b3b3b3] uppercase border-b border-[#282828] sticky top-0 bg-[#121212] z-10`}>
                <span className="text-center">#</span>
                <span>Title</span>
                {!hideAlbumColumn && <span>Album</span>}
                <span className="text-right flex justify-end pr-8"><FaClock size={14} /></span>
            </div>

            {/* Tracks */}
            <div className="mt-2">
                {localTracks.map((track, index) => {
                    const isCurrent = currentTrack && currentTrack.id === track.id;
                    const isPlayingCurrent = isCurrent && isPlaying;
                    return (
                        <div
                            key={track.id}
                            className={`grid ${gridCols} gap-4 px-4 py-2 hover:bg-[#2a2a2a] rounded-md group transition-colors cursor-pointer items-center`}
                            onClick={(e) => handlePlayClick(e, track)}
                        >
                            {/* Index / Play Button */}
                            <div className="flex items-center justify-center text-[#b3b3b3] text-sm w-5 h-5">
                                <span className={`group-hover:hidden ${isCurrent ? 'text-[#1ed760]' : ''}`}>
                                    {isPlayingCurrent ? (
                                        <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" alt="playing" className="w-3 h-3" />
                                    ) : (
                                        index + 1
                                    )}
                                </span>
                                <span className="hidden group-hover:block text-white">
                                    {isPlayingCurrent ? <FaPause size={12} /> : <FaPlay size={12} />}
                                </span>
                            </div>

                            {/* Title & Artist */}
                            <div className="flex items-center gap-3 overflow-hidden">
                                {track.album_art_path ? (
                                    <img src={`http://localhost:8000/${track.album_art_path}`} alt="" className="w-10 h-10 rounded-sm object-cover shadow-md" />
                                ) : (
                                    <div className="w-10 h-10 bg-[#282828] rounded-sm flex items-center justify-center text-gray-500">
                                        <span className="text-xs font-bold">♪</span>
                                    </div>
                                )}
                                <div className="flex flex-col overflow-hidden">
                                    <span className={`font-medium text-base truncate ${isCurrent ? 'text-[#1ed760]' : 'text-white'}`}>
                                        {track.title}
                                    </span>
                                    <Link 
                                        to={`/artist/${track.artist_id}`} 
                                        onClick={e => e.stopPropagation()}
                                        className="text-sm text-[#b3b3b3] truncate hover:text-white hover:underline"
                                    >
                                        {track.artist}
                                    </Link>
                                </div>
                            </div>

                            {/* Album */}
                            {!hideAlbumColumn && (
                                <div className="text-[#b3b3b3] text-sm truncate hover:text-white hover:underline">
                                    <Link to={`/album/${track.album_id}`} onClick={(e) => e.stopPropagation()}>
                                        {track.album || 'Unknown Album'}
                                    </Link>
                                </div>
                            )}

                            {/* Actions & Duration */}
                            <div className="flex items-center justify-end gap-3 text-[#b3b3b3] text-sm opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                <button
                                    onClick={(e) => handleFavorite(e, track)}
                                    className={`hover:text-white ${track.is_favorite ? 'text-[#1ed760] opacity-100' : ''}`}
                                >
                                    {track.is_favorite ? <FaHeart size={14} /> : <FaRegHeart size={14} />}
                                </button>

                                {allowManage && user && track.uploader_name === user.name && (
                                    <button
                                        onClick={(e) => handlePublish(e, track)}
                                        className="hover:text-white"
                                        title={track.is_public ? "Make Private" : "Publish"}
                                    >
                                        {track.is_public ? <FaGlobe size={14} /> : <FaLock size={14} />}
                                    </button>
                                )}

                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuTrackId(openMenuTrackId === track.id ? null : track.id); }}
                                        className="hover:text-white"
                                    >
                                        <FaPlus size={14} />
                                    </button>
                                    {openMenuTrackId === track.id && (
                                        <div className="absolute right-0 bottom-full mb-2 bg-[#282828] rounded shadow-xl z-50 min-w-[160px] py-1 border border-[#3e3e3e]">
                                            <div className="px-3 py-1 text-[10px] text-gray-400 uppercase font-bold tracking-wider">Add to Playlist</div>
                                            {playlists.length > 0 ? (
                                                playlists.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={(e) => handleAddToPlaylist(e, track.id, p.id)}
                                                        className="w-full text-left px-3 py-2 hover:bg-[#3e3e3e] text-sm text-white"
                                                    >
                                                        {p.name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-3 py-2 text-xs text-gray-500">No playlists</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <span className="w-10 text-right group-hover:text-white transition-colors">{track.duration ? `${Math.floor(track.duration / 60)}:${('0' + Math.floor(track.duration % 60)).slice(-2)}` : '--:--'}</span>
                            </div>
                            
                            {/* Duration (visible when not hovering) */}
                            <div className="text-[#b3b3b3] text-sm text-right pr-4 absolute right-4 group-hover:hidden">
                                {track.duration ? `${Math.floor(track.duration / 60)}:${('0' + Math.floor(track.duration % 60)).slice(-2)}` : '--:--'}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default TrackList;