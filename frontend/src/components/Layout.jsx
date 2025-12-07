import React from 'react';
import Sidebar from './Sidebar';
import Player from './Player';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children, currentTrack, isPlaying, onTogglePlay, setIsPlaying, onNext, onPrev, hasNext, hasPrev }) => {
    const { user, logout } = useAuth();

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden">
            <Sidebar hasPlayer={!!currentTrack} />
            <div className="flex-1 flex flex-col bg-[#121212] m-2 rounded-lg overflow-hidden relative">
                {/* Top Bar placeholder */}
                <header className="h-16 bg-[#101010] flex items-center px-8 sticky top-0 z-10 bg-opacity-90">
                    <div className="flex gap-4">
                        <button className="bg-black rounded-full p-1 text-gray-400 hover:text-white">{'<'}</button>
                        <button className="bg-black rounded-full p-1 text-gray-400 hover:text-white">{'>'}</button>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                        {user ? (
                            <div className="flex items-center gap-2 cursor-pointer hover:bg-[#282828] p-1 pr-3 rounded-full transition-colors" onClick={logout} title="Click to logout">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full" />
                                ) : (
                                    <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-xs">{user.name[0]}</div>
                                )}
                                <span className="font-bold text-sm">{user.name}</span>
                            </div>
                        ) : (
                            <a href="/login" className="bg-white text-black rounded-full px-4 py-1 font-bold text-sm hover:scale-105 inline-block">Log in</a>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 pb-32">
                    {children}
                </main>
            </div>
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
        </div>
    );
};

export default Layout;
