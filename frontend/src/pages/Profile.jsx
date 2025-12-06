import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import TrackList from '../components/TrackList';
import { FaUserCircle, FaMusic, FaCloudUploadAlt } from 'react-icons/fa';

const Profile = ({ onPlay }) => {
    const { userId } = useParams();
    const [user, setUser] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                let id = userId;
                if (!id) {
                    // If no userId param, try to get current user from local storage
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

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!user) return <div className="text-white p-8">User not found</div>;

    return (
        <div className="text-white">
            {/* Profile Header */}
            <div className="flex items-end gap-6 mb-8 p-6 bg-gradient-to-b from-[#535353] to-[#121212]">
                <div className="shadow-2xl rounded-full overflow-hidden w-52 h-52 flex items-center justify-center bg-[#282828]">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                        <FaUserCircle size={120} className="text-gray-400" />
                    )}
                </div>
                <div>
                    <span className="uppercase text-xs font-bold">Profile</span>
                    <h1 className="text-6xl font-black mb-4">{user.name}</h1>
                    <div className="text-sm font-medium text-gray-300">
                        {tracks.length} Public Tracks • {albums.length} Albums
                    </div>
                </div>
            </div>

            {/* Actions */}
            {user && user.id === parseInt(userId || user.id) && (
                <div className="px-6 mb-4 flex justify-end">
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
                        <TrackList tracks={tracks} onPlay={onPlay} allowManage={true} />
                    ) : (
                        <p className="text-gray-400">No public tracks yet.</p>
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
