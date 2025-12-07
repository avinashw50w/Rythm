import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import TrackList from '../components/TrackList';
import { FaUserCircle, FaPlay, FaPause, FaMusic, FaCamera, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const ArtistDetails = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { artistName } = useParams();
    const { user } = useAuth();
    const { showToast } = useUI();
    const [artist, setArtist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editBio, setEditBio] = useState('');
    const [editImage, setEditImage] = useState(null);

    useEffect(() => {
        fetchArtist();
    }, [artistName]);

    const fetchArtist = async () => {
        try {
            const res = await client.get(`/artists/${encodeURIComponent(artistName)}`);
            setArtist(res.data);
            setEditBio(res.data.bio || '');
        } catch (error) {
            console.error('Error fetching artist:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const formData = new FormData();
            formData.append('name', artistName);
            formData.append('bio', editBio);
            if (editImage) {
                formData.append('image', editImage);
            }

            const res = await client.put('/artists', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setArtist(prev => ({ 
                ...prev, 
                bio: res.data.bio,
                image_path: res.data.image_path 
            }));
            setIsEditing(false);
            setEditImage(null);
            showToast('Artist info updated', 'success');
        } catch (error) {
            console.error('Error updating artist:', error);
            showToast('Failed to update artist info', 'error');
        }
    };

    const handlePlayAll = () => {
        if (currentTrack && artist.tracks.some(t => t.id === currentTrack.id)) {
            onTogglePlay();
            return;
        }
        if (artist && artist.tracks.length > 0) {
            onPlay(artist.tracks[0], artist.tracks);
        }
    };

    const isPlayingArtist = isPlaying && currentTrack && artist?.tracks.some(t => t.id === currentTrack.id);

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!artist) return <div className="text-white p-8">Artist not found</div>;

    return (
        <div className="text-white pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-end gap-8 mb-8 p-8 bg-gradient-to-b from-[#4a3090] to-[#121212] rounded-lg">
                <div className="relative w-52 h-52 shadow-2xl rounded-full overflow-hidden flex-shrink-0 bg-[#282828] group">
                    {artist.image_path ? (
                        <img src={`http://localhost:8000/${artist.image_path}`} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <FaUserCircle size={140} className="text-gray-500" />
                        </div>
                    )}
                    
                    {user && (
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <div className="text-center">
                                <FaCamera size={24} className="mx-auto mb-2" />
                                <span className="text-sm font-bold">Change Photo</span>
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    setEditImage(e.target.files[0]);
                                    setIsEditing(true); // Auto enter edit mode on file pick
                                }}
                            />
                        </label>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <span className="uppercase text-xs font-bold flex items-center gap-2">
                        Artist <div className="h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center text-[8px]">✓</div>
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black mb-4 truncate">{artist.name}</h1>
                    
                    {isEditing ? (
                        <div className="mb-4 bg-[#282828] p-4 rounded-lg border border-gray-600">
                            <label className="block text-xs text-gray-400 mb-1">Bio</label>
                            <textarea
                                value={editBio}
                                onChange={(e) => setEditBio(e.target.value)}
                                className="w-full bg-[#3e3e3e] text-white p-2 rounded focus:outline-none mb-2 h-24"
                                placeholder="Write something about the artist..."
                            />
                            <div className="flex gap-2">
                                <button onClick={handleSave} className="bg-green-500 text-black px-4 py-1 rounded font-bold text-sm">Save</button>
                                <button onClick={() => setIsEditing(false)} className="border border-gray-500 px-4 py-1 rounded font-bold text-sm">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        artist.bio && <p className="text-gray-300 max-w-2xl mb-4 line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">{artist.bio}</p>
                    )}

                    <div className="flex items-center gap-4 mt-2">
                        <button
                            onClick={handlePlayAll}
                            className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg text-black"
                        >
                            {isPlayingArtist ? <FaPause size={24} className="ml-1" /> : <FaPlay size={24} className="ml-1" />}
                        </button>
                        
                        {user && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="border border-gray-500 text-white px-4 py-1 rounded-full font-bold text-sm hover:border-white">
                                Edit Info
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-8">
                {/* Popular Tracks */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Popular</h2>
                    {artist.tracks.length > 0 ? (
                        <TrackList
                            tracks={artist.tracks.slice(0, 5)}
                            onPlay={onPlay}
                            currentTrack={currentTrack}
                            isPlaying={isPlaying}
                            onTogglePlay={onTogglePlay}
                        />
                    ) : (
                        <p className="text-gray-400">No tracks found.</p>
                    )}
                </div>

                {/* Discography */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Discography</h2>
                    {artist.albums.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {artist.albums.map((album, index) => (
                                <Link to={`/album/${encodeURIComponent(album.title)}`} key={index} className="bg-[#181818] p-4 rounded-md hover:bg-[#282828] transition-colors cursor-pointer group block">
                                    <div className="bg-[#333] aspect-square rounded-md mb-4 flex items-center justify-center shadow-lg overflow-hidden">
                                        {album.album_art_path ? (
                                            <img src={`http://localhost:8000/${album.album_art_path}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <FaMusic size={48} className="text-gray-500" />
                                        )}
                                    </div>
                                    <h3 className="font-bold text-white mb-1 truncate">{album.title}</h3>
                                    <p className="text-sm text-gray-400">Album • {album.track_count} songs</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400">No albums found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArtistDetails;