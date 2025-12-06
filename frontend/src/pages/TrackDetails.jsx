import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FaPlay, FaPause, FaEdit, FaSave, FaTimes, FaMusic, FaGlobe, FaLock } from 'react-icons/fa';

const TrackDetails = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { trackId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [track, setTrack] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        artist: '',
        album: '',
        genre: ''
    });

    useEffect(() => {
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

        fetchTrack();
    }, [trackId, navigate]);

    const handleSave = async () => {
        try {
            const res = await client.put(`/tracks/${trackId}`, editForm);
            setTrack(prev => ({ ...prev, ...editForm }));
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating track:', error);
            alert('Failed to update track');
        }
    };

    const handlePlay = () => {
        if (currentTrack?.id === track.id) {
            onTogglePlay();
        } else {
            onPlay(track);
        }
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!track) return null;

    const isOwner = user && user.id === track.uploader_id;
    const isCurrentTrack = currentTrack?.id === track.id;

    return (
        <div className="text-white p-8 max-w-6xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-8 mb-12">
                {/* Album Art */}
                <div className="w-64 h-64 flex-shrink-0 bg-[#282828] shadow-2xl rounded-lg flex items-center justify-center overflow-hidden relative group">
                    {track.album_art_path ? (
                        <img src={`http://localhost:8000/${track.album_art_path}`} alt={track.album} className="w-full h-full object-cover" />
                    ) : (
                        <FaMusic size={80} className="text-gray-600" />
                    )}
                    <button
                        onClick={handlePlay}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <div className="bg-green-500 rounded-full p-4 shadow-lg transform hover:scale-105 transition-transform">
                            {isCurrentTrack && isPlaying ? (
                                <FaPause className="text-black text-xl" />
                            ) : (
                                <FaPlay className="text-black text-xl ml-1" />
                            )}
                        </div>
                    </button>
                </div>

                {/* Info */}
                <div className="flex flex-col justify-end flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="uppercase text-xs font-bold tracking-wider text-gray-400">Song</span>
                        {track.is_public ? (
                            <FaGlobe className="text-gray-400 text-xs" title="Public" />
                        ) : (
                            <FaLock className="text-gray-400 text-xs" title="Private" />
                        )}
                    </div>

                    {isEditing ? (
                        <div className="space-y-4 mb-4 bg-[#282828] p-6 rounded-lg border border-gray-700">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full bg-[#3e3e3e] text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-3xl font-bold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Artist</label>
                                    <input
                                        type="text"
                                        value={editForm.artist}
                                        onChange={e => setEditForm({ ...editForm, artist: e.target.value })}
                                        className="w-full bg-[#3e3e3e] text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Album</label>
                                    <input
                                        type="text"
                                        value={editForm.album}
                                        onChange={e => setEditForm({ ...editForm, album: e.target.value })}
                                        className="w-full bg-[#3e3e3e] text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Genre</label>
                                    <input
                                        type="text"
                                        value={editForm.genre}
                                        onChange={e => setEditForm({ ...editForm, genre: e.target.value })}
                                        className="w-full bg-[#3e3e3e] text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSave} className="bg-green-500 text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2">
                                    <FaSave /> Save
                                </button>
                                <button onClick={() => setIsEditing(false)} className="bg-transparent border border-gray-500 text-white px-6 py-2 rounded-full font-bold hover:border-white transition-colors flex items-center gap-2">
                                    <FaTimes /> Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">{track.title}</h1>
                            <div className="flex items-center gap-2 text-gray-300 font-medium text-sm md:text-base">
                                {track.artist && (
                                    <>
                                        <span className="text-white hover:underline cursor-pointer">{track.artist}</span>
                                        <span>•</span>
                                    </>
                                )}
                                {track.album && (
                                    <>
                                        <span className="hover:underline cursor-pointer">{track.album}</span>
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

                    {!isEditing && (
                        <div className="mt-6 flex items-center gap-4">
                            <button
                                onClick={handlePlay}
                                className="bg-green-500 text-black rounded-full p-4 hover:scale-105 transition-transform shadow-lg"
                            >
                                {isCurrentTrack && isPlaying ? <FaPause size={24} /> : <FaPlay size={24} className="ml-1" />}
                            </button>

                            {isOwner && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-gray-400 hover:text-white transition-colors p-2"
                                    title="Edit Details"
                                >
                                    <FaEdit size={24} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Additional Details / Recommended */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <h2 className="text-2xl font-bold mb-4">Recommended</h2>
                    <div className="bg-[#181818] rounded-lg p-6 text-center text-gray-400">
                        <p>Recommended tracks based on this song will appear here.</p>
                        <p className="text-sm mt-2">(Recommendation engine coming soon)</p>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-bold mb-4">Credits</h2>
                    <div className="bg-[#181818] rounded-lg p-6 space-y-4">
                        <div>
                            <h3 className="text-white font-bold">{track.artist || 'Unknown Artist'}</h3>
                            <p className="text-sm text-gray-400">Main Artist</p>
                        </div>
                        <div>
                            <h3 className="text-white font-bold">{track.uploader_name}</h3>
                            <p className="text-sm text-gray-400">Uploaded By</p>
                        </div>
                        <div className="pt-4 border-t border-gray-700">
                            <div className="flex justify-between text-sm text-gray-400 mb-1">
                                <span>Format</span>
                                <span>MP3 / {track.bitrate ? Math.round(parseInt(track.bitrate) / 1000) : '?'}kbps</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Size</span>
                                <span>{(track.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackDetails;
