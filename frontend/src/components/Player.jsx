import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';

const Player = ({ currentTrack, isPlaying, onTogglePlay, setIsPlaying }) => {
    // const [isPlaying, setIsPlaying] = useState(false); // Removed local state
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const audioRef = useRef(null);

    useEffect(() => {
        if (currentTrack) {
            setIsPlaying(true);
        }
    }, [currentTrack]);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(e => console.error("Playback failed:", e));
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, currentTrack]);

    const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current.currentTime);
        setDuration(audioRef.current.duration);
    };

    const handleSeek = (e) => {
        const time = e.target.value;
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const handleVolumeChange = (e) => {
        const vol = e.target.value;
        setVolume(vol);
        audioRef.current.volume = vol;
    };

    const formatTime = (time) => {
        if (!time) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    if (!currentTrack) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 glass-player text-white p-4 h-24 flex items-center justify-between z-50 px-6">
            <audio
                ref={audioRef}
                src={`http://localhost:8000/tracks/${currentTrack.id}/stream`}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
            />

            {/* Track Info */}
            <div className="flex items-center gap-4 w-1/3">
                <div className="w-14 h-14 bg-[#282828] rounded-md shadow-lg overflow-hidden flex-shrink-0">
                    {currentTrack.album_art_path ? (
                        <img src={`http://localhost:8000/${currentTrack.album_art_path}`} alt="Album Art" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                            <span className="text-xs text-gray-400">No Art</span>
                        </div>
                    )}
                </div>
                <div className="overflow-hidden">
                    <Link to={`/track/${currentTrack.id}`} className="font-bold text-sm truncate hover:underline cursor-pointer block text-white">
                        {currentTrack.title}
                    </Link>
                    <div className="text-xs text-gray-400 truncate">{currentTrack.artist}</div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-2 w-1/3">
                <div className="flex items-center gap-6">
                    <button className="text-gray-400 hover:text-white transition-colors">
                        <FaStepBackward size={18} />
                    </button>
                    <button
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
                        onClick={onTogglePlay}
                    >
                        {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} className="ml-1" />}
                    </button>
                    <button className="text-gray-400 hover:text-white transition-colors">
                        <FaStepForward size={18} />
                    </button>
                </div>
                <div className="flex items-center gap-2 w-full max-w-md">
                    <span className="text-xs text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white hover:accent-green-500"
                    />
                    <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Volume */}
            <div className="flex items-center justify-end gap-2 w-1/3">
                <button onClick={() => setVolume(volume === 0 ? 1 : 0)}>
                    {volume === 0 ? <FaVolumeMute size={18} className="text-gray-400" /> : <FaVolumeUp size={18} className="text-gray-400" />}
                </button>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white hover:accent-green-500"
                />
            </div>
        </div>
    );
};

export default Player;
