import React, { useEffect, useState } from 'react';
import client from '../api/client';
import TrackList from '../components/TrackList';
import { FaHeart, FaPlay, FaPause } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const LikedSongs = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { user } = useAuth();
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLikedSongs();
    }, []);

    const fetchLikedSongs = async () => {
        try {
            const res = await client.get('/users/favorites');
            // Backend now includes is_favorite=True in response
            setTracks(res.data);
        } catch (error) {
            console.error("Error fetching liked songs:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayAll = () => {
        if (currentTrack && tracks.some(t => t.id === currentTrack.id)) {
            onTogglePlay();
            return;
        }

        if (tracks.length > 0) {
            onPlay(tracks[0]);
        }
    };

    // Check if any track from favorites is currently playing
    const isPlayingFavorites = isPlaying && currentTrack && tracks.some(t => t.id === currentTrack.id);

    if (loading) return <div className="text-white p-8">Loading...</div>;

    return (
        <div className="text-white p-8 pb-32 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-8 mb-8 items-end bg-gradient-to-b from-[#5038a0] to-[#121212] p-8 rounded-lg">
                <div className="w-52 h-52 bg-gradient-to-br from-[#450af5] to-[#c4efd9] shadow-2xl flex items-center justify-center flex-shrink-0 rounded-md">
                    <FaHeart size={80} className="text-white drop-shadow-lg" />
                </div>

                <div className="flex flex-col gap-2 flex-grow min-w-0">
                    <span className="uppercase text-xs font-bold tracking-wider text-white">Playlist</span>
                    <h1 className="text-5xl md:text-7xl font-black truncate leading-tight py-2">Liked Songs</h1>

                    <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mt-2">
                        {user && <span className="text-white font-bold">{user.name}</span>}
                        <span>•</span>
                        <span>{tracks.length} songs</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mb-8 px-4">
                <button
                    onClick={handlePlayAll}
                    className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg text-black"
                >
                    {isPlayingFavorites ? <FaPause size={24} className="ml-1" /> : <FaPlay size={24} className="ml-1" />}
                </button>
            </div>

            {/* Tracks */}
            <div className="px-4">
                <TrackList
                    tracks={tracks}
                    onPlay={onPlay}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onTogglePlay={onTogglePlay}
                />
            </div>
        </div>
    );
};

export default LikedSongs;
