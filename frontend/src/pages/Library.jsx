import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { Link } from 'react-router-dom';
import { FaMusic, FaHeart } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const Library = () => {
    const { user } = useAuth();
    const [playlists, setPlaylists] = useState([]);
    const [favorites, setFavorites] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            
            try {
                // Correct endpoint for listing user playlists
                const playlistsRes = await client.get('/playlists');
                setPlaylists(playlistsRes.data);

                const favoritesRes = await client.get('/users/favorites');
                setFavorites(favoritesRes.data);
            } catch (error) {
                console.error('Error fetching library:', error);
            }
        };

        fetchData();
    }, [user]);

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Your Library</h1>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <Link to="/liked-songs" className="bg-gradient-to-br from-indigo-700 to-blue-300 p-6 rounded-md aspect-square flex flex-col justify-end group cursor-pointer hover:scale-105 transition-transform">
                    <div className="mb-4">
                        <span className="text-white text-3xl font-bold line-clamp-3">Liked Songs</span>
                    </div>
                    <div className="text-white text-sm font-bold">{favorites.length} liked songs</div>
                    <div className="mt-4 bg-green-500 rounded-full p-3 shadow-lg w-12 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 absolute bottom-4 right-4">
                        <FaHeart className="text-white" />
                    </div>
                </Link>

                {playlists.map(playlist => (
                    <Link to={`/playlist/${playlist.id}`} key={playlist.id} className="bg-[#181818] p-4 rounded-md hover:bg-[#282828] transition-colors cursor-pointer group">
                        <div className="bg-[#333] aspect-square rounded-md mb-4 flex items-center justify-center shadow-lg overflow-hidden">
                            {playlist.thumbnail_path ? (
                                <img src={`http://localhost:8000/${playlist.thumbnail_path}`} className="w-full h-full object-cover" />
                            ) : (
                                <FaMusic size={48} className="text-gray-500" />
                            )}
                        </div>
                        <h3 className="font-bold text-white mb-1 truncate">{playlist.name}</h3>
                        <p className="text-sm text-gray-400">{playlist.track_count} songs</p>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default Library;