import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaHome, FaSearch, FaBook, FaPlusSquare, FaHeart, FaMusic } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const Sidebar = ({ hasPlayer }) => {
    const location = useLocation();
    const { user } = useAuth();
    const [playlists, setPlaylists] = useState([]);

    const fetchPlaylists = async () => {
        if (!user) return;
        try {
            const res = await client.get('/playlists/');
            setPlaylists(res.data);
        } catch (error) {
            console.error('Error fetching playlists:', error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchPlaylists();
        } else {
            setPlaylists([]);
        }

        const handlePlaylistUpdate = () => {
            fetchPlaylists();
        };

        window.addEventListener('playlist-updated', handlePlaylistUpdate);
        return () => {
            window.removeEventListener('playlist-updated', handlePlaylistUpdate);
        };
    }, [user]);

    const isActive = (path) => location.pathname === path;

    const NavItem = ({ to, icon: Icon, label, active }) => (
        <Link
            to={to}
            className={`flex items-center gap-4 px-6 py-2 transition-all duration-200 group ${active ? 'text-white' : 'text-[#b3b3b3] hover:text-white'
                }`}
        >
            <Icon size={24} className={active ? 'text-white' : 'text-[#b3b3b3] group-hover:text-white'} />
            <span className={`font-bold text-sm truncate`}>{label}</span>
        </Link>
    );

    return (
        <div className="w-64 bg-black h-full flex flex-col flex-shrink-0">
            {/* Logo Area */}
            <div className="px-6 py-6">
                <Link to="/" className="flex items-center gap-2 text-white">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                        <span className="text-black font-black text-xl">R</span>
                    </div>
                    <span className="text-2xl font-bold tracking-tighter">Rythm</span>
                </Link>
            </div>

            {/* Main Nav */}
            <nav className="flex flex-col gap-2 mb-6">
                <NavItem to="/" icon={FaHome} label="Home" active={isActive('/')} />
                <NavItem to="/search" icon={FaSearch} label="Search" active={isActive('/search')} />
            </nav>

            {/* Library Section */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#121212] mx-2 mb-2 rounded-lg pt-4">
                <div className="px-6 mb-2 flex items-center justify-between text-[#b3b3b3] hover:text-white transition-colors cursor-pointer group">
                    <Link to="/library" className="flex items-center gap-2">
                        <FaBook className="group-hover:text-white" />
                        <span className="font-bold text-sm">Your Library</span>
                    </Link>
                    <Link to="/create-playlist" className="hover:bg-[#282828] p-1 rounded-full text-[#b3b3b3] hover:text-white">
                        <FaPlusSquare size={18} />
                    </Link>
                </div>

                {/* Fixed Library Items */}
                <div className="mt-2 mb-4 flex flex-col gap-2">
                    <Link 
                        to="/liked-songs"
                        className={`flex items-center gap-3 px-6 py-2 group cursor-pointer ${isActive('/liked-songs') ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a]'}`}
                    >
                        <div className="w-8 h-8 bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center rounded-sm opacity-70 group-hover:opacity-100">
                            <FaHeart className="text-white text-xs" />
                        </div>
                        <span className={`text-sm font-bold ${isActive('/liked-songs') ? 'text-white' : 'text-[#b3b3b3] group-hover:text-white'}`}>Liked Songs</span>
                    </Link>
                </div>

                {/* Playlist Scroll Area */}
                <div className="flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar">
                    {user && playlists.length > 0 ? (
                        <div className="flex flex-col gap-3 mt-2">
                            {playlists.map(playlist => (
                                <Link
                                    key={playlist.id}
                                    to={`/playlist/${playlist.id}`}
                                    className={`text-sm truncate cursor-pointer transition-colors ${isActive(`/playlist/${playlist.id}`) ? 'text-white' : 'text-[#b3b3b3] hover:text-white'}`}
                                >
                                    {playlist.name}
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-4 p-4 bg-[#242424] rounded-lg">
                            <p className="text-white font-bold text-sm mb-1">Create your first playlist</p>
                            <p className="text-xs text-white mb-4">It's easy, we'll help you.</p>
                            <Link to="/create-playlist" className="bg-white text-black text-xs font-bold px-4 py-2 rounded-full inline-block hover:scale-105 transition-transform">
                                Create playlist
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;