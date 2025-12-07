import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import TrackList from '../components/TrackList';
import { FaUserCircle, FaMusic, FaCloudUploadAlt, FaEdit } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const Profile = ({ onPlay, currentTrack, isPlaying, onTogglePlay }) => {
    const { userId } = useParams();
    const { user: authUser, setUser: setAuthUser } = useAuth();
    const [user, setUser] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                let id = userId;
                if (!id) {
                    const storedUser = localStorage.getItem('user');
                    if (storedUser) {
                        id = JSON.parse(storedUser).id;
                    }
                }

                if (!id) return;

                const [userRes, tracksRes, albumsRes] = await Promise.all([
                    client.get(`/users/${id}`),
                    client.get(`/users/${id}/tracks`),
                    client.get(`/users/${id}/albums`)
                ]);
                setUser(userRes.data);
                setEditName(userRes.data.name);
                setTracks(tracksRes.data);
                setAlbums(albumsRes.data);
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [userId]);

    const isOwner = authUser && user && authUser.id === user.id;

    const handleSaveProfile = async () => {
        try {
            const formData = new FormData();
            formData.append('name', editName);
            if (editAvatar) {
                formData.append('avatar', editAvatar);
            }

            const res = await client.put('/users/profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUser(prev => ({ ...prev, name: res.data.name, avatar_url: res.data.avatar_url }));

            // Update auth context and localStorage
            const updatedUser = { ...authUser, name: res.data.name, avatar_url: res.data.avatar_url };
            setAuthUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            setIsEditing(false);
            setEditAvatar(null);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
        }
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!user) return <div className="text-white p-8">User not found</div>;

    return (
        <div className="text-white pb-32">
            {/* Profile Header */}
            <div className="flex items-end gap-6 mb-8 p-6 bg-gradient-to-b from-[#535353] to-[#121212]">
                <div className="relative shadow-2xl rounded-full overflow-hidden w-52 h-52 flex items-center justify-center bg-[#282828]">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                        <FaUserCircle size={120} className="text-gray-400" />
                    )}
                    {isOwner && isEditing && (
                        <label className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors">
                            <span className="text-sm font-bold">Change Photo</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => setEditAvatar(e.target.files[0])}
                            />
                        </label>
                    )}
                </div>
                <div className="flex-1">
                    <span className="uppercase text-xs font-bold">Profile</span>
                    {isEditing ? (
                        <div className="mt-2">
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="text-4xl font-black mb-4 bg-transparent border-b-2 border-white/50 focus:border-green-500 outline-none w-full"
                            />
                            <div className="flex gap-2 mt-4">
                                <button onClick={handleSaveProfile} className="bg-green-500 text-black font-bold px-6 py-2 rounded-full hover:bg-green-400">Save</button>
                                <button onClick={() => { setIsEditing(false); setEditName(user.name); }} className="border border-gray-500 px-6 py-2 rounded-full hover:bg-white/10">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-6xl font-black mb-4">{user.name}</h1>
                            <div className="text-sm font-medium text-gray-300">
                                {tracks.length} Tracks • {albums.length} Albums
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Actions */}
            {isOwner && !isEditing && (
                <div className="px-6 mb-4 flex justify-end gap-4">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="border border-gray-500 text-white font-bold py-2 px-6 rounded-full hover:bg-white/10 transition-all flex items-center gap-2"
                    >
                        <FaEdit size={16} />
                        Edit Profile
                    </button>
                    <Link to="/upload" className="bg-green-500 hover:bg-green-400 text-black font-bold py-2 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all flex items-center gap-2">
                        <FaCloudUploadAlt size={20} />
                        Upload Music
                    </Link>
                </div>
            )}

            <div className="px-6">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-4">Tracks</h2>
                    {tracks.length > 0 ? (
                        <TrackList
                            tracks={tracks}
                            onPlay={onPlay}
                            currentTrack={currentTrack}
                            isPlaying={isPlaying}
                            onTogglePlay={onTogglePlay}
                            allowManage={isOwner}
                        />
                    ) : (
                        <p className="text-gray-400">No tracks yet.</p>
                    )}
                </div>

                {/* Albums */}
                <div>
                    <h2 className="text-2xl font-bold mb-4">Albums</h2>
                    {albums.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {albums.map((album, index) => (
                                <Link to={`/album/${encodeURIComponent(album.name)}`} key={index} className="bg-[#181818] p-4 rounded-md hover:bg-[#282828] transition-colors cursor-pointer group block">
                                    <div className="bg-[#333] aspect-square rounded-md mb-4 flex items-center justify-center shadow-lg overflow-hidden">
                                        {album.cover_art ? (
                                            <img src={`http://localhost:8000/${album.cover_art}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <FaMusic size={48} className="text-gray-500" />
                                        )}
                                    </div>
                                    <h3 className="font-bold text-white mb-1 truncate">{album.name}</h3>
                                    <p className="text-sm text-gray-400">{album.artist}</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400">No albums yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
