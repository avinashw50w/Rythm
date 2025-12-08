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
    const [editForm, setEditForm] = useState({ new_name: '', artist: '', genre: '' });

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

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!album) return <div className="text-white p-8">Album not found</div>;

    const isPlayingThisAlbum = isPlaying && currentTrack && album.tracks.some(t => t.id === currentTrack.id);
    const isOwner = album?.is_owner;

    // Simulate dynamic background color (would normally extract from image)
    const bgColor = 'from-[#503e3e]'; 

    return (
        <div className="text-white pb-32">
            {/* Hero Section */}
            <div className={`flex flex-col md:flex-row gap-6 p-8 items-end bg-gradient-to-b ${bgColor} to-[#121212] pt-24`}>
                {/* Album Art */}
                <div className="w-52 h-52 shadow-[0_4px_60px_rgba(0,0,0,0.5)] flex-shrink-0 bg-[#282828] group relative">
                    {album.album_art_path ? (
                        <img src={`http://localhost:8000/${album.album_art_path}`} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500"><FaMusic size={64} /></div>
                    )}
                </div>

                {/* Metadata */}
                <div className="flex flex-col gap-2 flex-grow">
                    <span className="uppercase text-xs font-bold tracking-wider text-white">Album</span>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none mb-4">{album.name}</h1>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        {user && user.avatar_url && <img src={user.avatar_url} className="w-6 h-6 rounded-full" />}
                        <span className="font-bold hover:underline cursor-pointer">{album.artist}</span>
                        <span className="text-white/70">• {new Date().getFullYear()} • {album.track_count} songs, <span className="text-white/50">{Math.floor(album.total_duration / 60)} min {Math.floor(album.total_duration % 60)} sec</span></span>
                    </div>
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

                {isOwner && (
                    <div className="ml-auto flex gap-4">
                        <button className="text-sm font-bold text-[#b3b3b3] hover:text-white border border-gray-600 rounded-full px-4 py-1">Edit</button>
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