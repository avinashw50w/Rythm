import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import TrackList from '../components/TrackList';
import { FaUserCircle, FaPlay, FaPause, FaMusic, FaCamera, FaEdit, FaCheckCircle } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const ArtistDetails = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { artistId } = useParams();
    const { user } = useAuth();
    const { showToast } = useUI();
    const [artist, setArtist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editBio, setEditBio] = useState('');
    const [editName, setEditName] = useState('');
    const [editImage, setEditImage] = useState(null);

    useEffect(() => {
        fetchArtist();
    }, [artistId]);

    const fetchArtist = async () => {
        try {
            const res = await client.get(`/artists/${artistId}`);
            setArtist(res.data);
            setEditBio(res.data.bio || '');
            setEditName(res.data.name || '');
        } catch (error) {
            console.error('Error fetching artist:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const formData = new FormData();
            formData.append('name', editName);
            formData.append('bio', editBio);
            if (editImage) {
                formData.append('image', editImage);
            }

            const res = await client.put(`/artists/${artistId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setArtist(prev => ({ 
                ...prev, 
                name: res.data.name,
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

    // Use artist image as background if available
    const headerStyle = artist.image_path 
        ? { backgroundImage: `url(http://localhost:8000/${artist.image_path})`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }
        : { background: 'linear-gradient(to bottom, #4a3090, #121212)' };

    return (
        <div className="text-white pb-32">
            {/* Immersive Header */}
            <div className="relative h-[40vh] min-h-[340px] w-full" style={headerStyle}>
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent"></div>
                
                <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col justify-end h-full">
                    <div className="flex items-center gap-2 mb-2">
                        <FaCheckCircle className="text-[#3d91f4] bg-white rounded-full border-2 border-white" size={24} />
                        <span className="text-sm font-medium">Verified Artist</span>
                    </div>
                    
                    {isEditing ? (
                        <div className="bg-black/50 backdrop-blur-md p-6 rounded-lg max-w-2xl border border-white/20">
                            <input 
                                className="bg-transparent text-white p-2 rounded w-full mb-4 text-4xl font-black border-b border-white/50 focus:border-green-500 outline-none"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Artist Name"
                            />
                            <textarea
                                value={editBio}
                                onChange={(e) => setEditBio(e.target.value)}
                                className="w-full bg-white/10 text-white p-3 rounded focus:outline-none mb-4 h-32 resize-none"
                                placeholder="Artist Bio..."
                            />
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors text-sm font-bold">
                                    <FaCamera /> Change Cover
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => setEditImage(e.target.files[0])}
                                    />
                                </label>
                                <div className="ml-auto flex gap-2">
                                    <button onClick={handleSave} className="bg-green-500 text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform">Save</button>
                                    <button onClick={() => setIsEditing(false)} className="border border-white/30 px-6 py-2 rounded-full font-bold hover:border-white transition-colors">Cancel</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <h1 className="text-5xl md:text-8xl font-black mb-4 tracking-tighter drop-shadow-2xl">{artist.name}</h1>
                    )}
                    
                    {!isEditing && (
                        <p className="text-base font-medium drop-shadow-md">
                            {artist.tracks.length * 1234} monthly listeners
                        </p>
                    )}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="px-8 py-6 flex items-center gap-8">
                <button
                    onClick={handlePlayAll}
                    className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg text-black"
                >
                    {isPlayingArtist ? <FaPause size={24} /> : <FaPlay size={24} className="ml-1" />}
                </button>
                
                <button className="border border-gray-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest hover:border-white hover:scale-105 transition-all">
                    Follow
                </button>

                {user && !isEditing && (
                    <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-white transition-colors ml-auto">
                        <FaEdit size={24} />
                    </button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-12 px-8 mt-4">
                {/* Popular Tracks */}
                <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-6">Popular</h2>
                    {artist.tracks.length > 0 ? (
                        <TrackList
                            tracks={artist.tracks.slice(0, 5)}
                            onPlay={onPlay}
                            currentTrack={currentTrack}
                            isPlaying={isPlaying}
                            onTogglePlay={onTogglePlay}
                            hideAlbumColumn={true}
                        />
                    ) : (
                        <p className="text-gray-400">No tracks found.</p>
                    )}
                </div>

                {/* About (Right Side on large screens) */}
                {artist.bio && (
                    <div className="lg:w-1/3">
                        <h2 className="text-2xl font-bold mb-6">About</h2>
                        <div className="relative bg-[#282828] rounded-lg overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform">
                            {artist.image_path && (
                                <div className="h-64 bg-cover bg-center" style={{ backgroundImage: `url(http://localhost:8000/${artist.image_path})` }}></div>
                            )}
                            <div className="p-6">
                                <p className="text-gray-300 line-clamp-6 font-medium leading-relaxed">{artist.bio}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Discography */}
            <div className="px-8 mt-12">
                <h2 className="text-2xl font-bold mb-6">Discography</h2>
                {artist.albums.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {artist.albums.map((album, index) => (
                            <Link to={`/album/${album.id}`} key={index} className="bg-[#181818] p-4 rounded-md hover:bg-[#282828] transition-colors cursor-pointer group block">
                                <div className="bg-[#333] aspect-square rounded-md mb-4 flex items-center justify-center shadow-lg overflow-hidden relative">
                                    {album.album_art_path ? (
                                        <img src={`http://localhost:8000/${album.album_art_path}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <FaMusic size={48} className="text-gray-500" />
                                    )}
                                </div>
                                <h3 className="font-bold text-white mb-1 truncate">{album.title}</h3>
                                <p className="text-sm text-gray-400">{new Date().getFullYear()} • Album</p>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400">No albums found.</p>
                )}
            </div>
        </div>
    );
};

export default ArtistDetails;
