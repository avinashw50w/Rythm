import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaHome, FaSearch, FaBook, FaPlusSquare, FaHeart, FaCog, FaUserCircle } from 'react-icons/fa';

const Sidebar = ({ hasPlayer }) => {
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const NavItem = ({ to, icon: Icon, label, active }) => (
        <Link
            to={to}
            className={`flex items-center gap-4 px-4 py-3 transition-all duration-200 rounded-md group ${active ? 'text-white bg-[#282828]' : 'text-[#b3b3b3] hover:text-white hover:bg-[#121212]'
                }`}
        >
            <Icon size={24} className={`transition-transform duration-200 group-hover:scale-105 ${active ? 'text-white' : ''}`} />
            <span className={`font-bold text-sm ${active ? 'text-white' : ''}`}>{label}</span>
        </Link>
    );

    return (
        <div className={`w-64 bg-black h-full flex flex-col p-2 gap-2 ${hasPlayer ? 'pb-28' : 'pb-2'}`}>
            {/* Logo Area */}
            <div className="px-6 py-5 mb-2">
                <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-lg">R</span>
                    Rythm
                </h1>
            </div>

            <nav className="flex flex-col gap-1 px-2">
                <NavItem to="/" icon={FaHome} label="Home" active={isActive('/')} />
                <NavItem to="/search" icon={FaSearch} label="Search" active={isActive('/search')} />
                <NavItem to="/library" icon={FaBook} label="Your Library" active={isActive('/library')} />
            </nav>

            <div className="mt-6 px-2">
                <div className="flex flex-col gap-1">
                    <NavItem to="/create-playlist" icon={FaPlusSquare} label="Create Playlist" active={isActive('/create-playlist')} />
                    <NavItem to="/liked-songs" icon={FaHeart} label="Liked Songs" active={isActive('/liked-songs')} />
                </div>
            </div>

            <div className="mt-auto px-2 pb-4 border-t border-[#282828] pt-4">
                <NavItem to="/profile" icon={FaUserCircle} label="Profile" active={isActive('/profile') || location.pathname.startsWith('/profile')} />
                <NavItem to="/settings" icon={FaCog} label="Settings" active={isActive('/settings')} />
            </div>
        </div>
    );
};

export default Sidebar;
