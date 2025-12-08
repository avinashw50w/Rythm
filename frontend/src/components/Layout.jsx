import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Player from './Player';
import { useAuth } from '../context/AuthContext';
import { FaChevronLeft, FaChevronRight, FaUser } from 'react-icons/fa';

const Layout = ({ children, currentTrack, isPlaying, onTogglePlay, setIsPlaying, onNext, onPrev, hasNext, hasPrev }) => {
    const { user, logout } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const mainRef = useRef(null);

    const handleScroll = (e) => {
        setScrolled(e.target.scrollTop > 60);
    };

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden p-2 gap-2">
            <Sidebar hasPlayer={!!currentTrack} />
            
            <div className="flex-1 flex flex-col bg-[#121212] rounded-lg overflow-hidden relative isolate">
                {/* Top Bar */}
                <header 
                    className={`h-16 flex items-center px-8 absolute top-0 left-0 right-0 z-20 transition-colors duration-300 ${scrolled ? 'bg-[#070707]' : 'bg-transparent'}`}
                >
                    <div className="flex gap-4">
                        <button className="bg-black/70 rounded-full p-2 text-gray-300 hover:text-white cursor-not-allowed">
                            <FaChevronLeft size={16} />
                        </button>
                        <button className="bg-black/70 rounded-full p-2 text-gray-300 hover:text-white cursor-not-allowed">
                            <FaChevronRight size={16} />
                        </button>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                        {user ? (
                            <div className="relative group">
                                <button className="bg-black/70 flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-[#282828] transition-colors">
                                    {user.avatar_url ? (
                                        <img 
                                            src={user.avatar_url} 
                                            alt={user.name} 
                                            className="w-7 h-7 rounded-full" 
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 bg-[#535353] rounded-full flex items-center justify-center">
                                            <FaUser size={12} />
                                        </div>
                                    )}
                                    <span className="font-bold text-sm truncate max-w-[100px]">{user.name}</span>
                                </button>
                                {/* Dropdown Menu */}
                                <div className="absolute right-0 top-full mt-2 w-48 bg-[#282828] rounded shadow-xl p-1 hidden group-hover:block border border-[#3e3e3e]">
                                    <a href="/profile" className="block px-4 py-2 text-sm hover:bg-[#3e3e3e] rounded text-left">Profile</a>
                                    <a href="/settings" className="block px-4 py-2 text-sm hover:bg-[#3e3e3e] rounded text-left">Settings</a>
                                    <div className="h-px bg-[#3e3e3e] my-1"></div>
                                    <button onClick={logout} className="block w-full px-4 py-2 text-sm hover:bg-[#3e3e3e] rounded text-left">Log out</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-6 items-center">
                                <a href="/login" className="text-[#b3b3b3] hover:text-white font-bold hover:scale-105 transition-transform">Sign up</a>
                                <a href="/login" className="bg-white text-black rounded-full px-8 py-3 font-bold text-sm hover:scale-105 transition-transform">Log in</a>
                            </div>
                        )}
                    </div>
                </header>

                <main 
                    ref={mainRef}
                    className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar relative z-10"
                    onScroll={handleScroll}
                >
                    {children}
                </main>
            </div>

            {/* Global Player Overlay */}
            {currentTrack && (
                <Player
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onTogglePlay={onTogglePlay}
                    setIsPlaying={setIsPlaying}
                    onNext={onNext}
                    onPrev={onPrev}
                    hasNext={hasNext}
                    hasPrev={hasPrev}
                />
            )}
        </div>
    );
};

export default Layout;