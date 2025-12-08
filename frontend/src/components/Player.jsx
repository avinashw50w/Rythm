
import React, { useState, useRef, useEffect } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaVolumeMute, FaExpandAlt, FaCompressAlt, FaHeart, FaRegHeart, FaMagic, FaChevronUp, FaChevronDown, FaVideo } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useUI } from '../context/UIContext';
import Wavis from '../lib/wavis';

const Player = ({ currentTrack, isPlaying, setIsPlaying, onTogglePlay, onNext, onPrev, hasNext, hasPrev }) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isFavorite, setIsFavorite] = useState(false);
    const [visualizerName, setVisualizerName] = useState('bars');
    const [showVizMenu, setShowVizMenu] = useState(false);
    const [availableVideos, setAvailableVideos] = useState([]);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [showVideoMenu, setShowVideoMenu] = useState(false);
    
    const audioRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const canvasRef = useRef(null);
    const wavisRef = useRef(null);
    const { showToast } = useUI();

    useEffect(() => {
        if (currentTrack) {
            setIsFavorite(currentTrack.is_favorite);
        }
    }, [currentTrack]);

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const res = await client.get('/videos');
                setAvailableVideos(res.data);
            } catch (error) {
                console.error("Failed to fetch videos", error);
            }
        };
        fetchVideos();
    }, []);

    const toggleFavorite = async () => {
        if (!currentTrack) return;
        try {
            const res = await client.post(`/users/favorites/${currentTrack.id}`);
            setIsFavorite(res.data.is_favorite);
            showToast(res.data.is_favorite ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'success');
        } catch (error) {
            console.error(error);
        }
    };

    // Initialize Wavis
    useEffect(() => {
        if (audioRef.current && !wavisRef.current) {
            wavisRef.current = new Wavis(audioRef.current);
        }
    }, []);

    // Handle Fullscreen Visualizer
    useEffect(() => {
        if (isFullScreen && wavisRef.current && canvasRef.current) {
            // Determine if we should start the visualizer based on the selected mode
            if (visualizerName !== 'none' && visualizerName !== 'album art') {
                setTimeout(() => {
                    if (canvasRef.current) {
                        wavisRef.current.mount(canvasRef.current);
                        wavisRef.current.start();
                        wavisRef.current.setVisualizer(visualizerName);
                    }
                }, 100);
            }
        }

        return () => {
            if (wavisRef.current && !isFullScreen) {
                wavisRef.current.unmount();
            }
        };
    }, [isFullScreen]);

    // Handle Visualizer State Changes
    useEffect(() => {
        if (!wavisRef.current || !isFullScreen) return;

        if (visualizerName === 'none' || visualizerName === 'album art') {
            wavisRef.current.stop();
            // Clear canvas manually
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && canvasRef.current) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        } else {
            // Ensure it's mounted if switching back from none/album art
            if (canvasRef.current) {
                wavisRef.current.mount(canvasRef.current);
                wavisRef.current.setVisualizer(visualizerName);
                if (isPlaying) wavisRef.current.start();
            }
        }
    }, [visualizerName, isFullScreen, isPlaying]);

    // Handle Playback State for Visualizer
    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(e => console.error("Playback failed:", e));
                if (isFullScreen && wavisRef.current && visualizerName !== 'none' && visualizerName !== 'album art') {
                    wavisRef.current.start();
                }
            } else {
                audioRef.current.pause();
                // We don't stop the visualizer loop on pause to keep the last frame or let it idle if we wanted
                // but Wavis.stop() kills the loop. Let's leave it running or stop it?
                // Usually visualizers stop moving when audio pauses. Wavis relies on audio data.
                // If audio pauses, frequency data becomes 0. The loop continues drawing 0s.
            }
        }
    }, [isPlaying, currentTrack, isFullScreen, visualizerName]);

    // Auto-hide controls
    useEffect(() => {
        if (!isFullScreen) {
            setShowControls(true);
            return;
        }
        resetControlsTimeout();
        return () => clearTimeout(controlsTimeoutRef.current);
    }, [isFullScreen, showVizMenu, showVideoMenu]);

    const resetControlsTimeout = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (!showVizMenu && !showVideoMenu) { // Don't hide if menu is open
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 4000);
        }
    };

    const handleFullScreenMouseMove = () => {
        if (!isFullScreen) return;
        resetControlsTimeout();
    };

    const selectVisualizer = (name) => {
        setVisualizerName(name);
        setShowVizMenu(false);
    };

    const selectVideo = (video) => {
        setCurrentVideo(video);
        setShowVideoMenu(false);
    };

    const handleTimeUpdate = () => {
        if(audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e) => {
        const time = e.target.value;
        if(audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleVolumeChange = (e) => {
        const vol = e.target.value;
        setVolume(vol);
        if(audioRef.current) {
            audioRef.current.volume = vol;
        }
    };

    const handleTrackEnd = () => {
        if (hasNext) {
            onNext();
        } else {
            setIsPlaying(false);
        }
    };

    const formatTime = (time) => {
        if (!time) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const visualizerOptions = ['none', 'album art', 'bars', 'wave', 'circle', 'dots', 'shockwave'];

    if (!currentTrack) return null;

    return (
        <>
            {/* Full Screen Visualizer Overlay */}
            <div 
                className={`fixed inset-0 z-[100] bg-black transition-all duration-700 ease-in-out ${isFullScreen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'} ${!showControls && !showVizMenu && !showVideoMenu ? 'cursor-none' : ''}`}
                onMouseMove={handleFullScreenMouseMove}
                onClick={handleFullScreenMouseMove}
            >
                {/* Background Video */}
                {currentVideo && (
                    <video
                        src={`http://localhost:8000/assets/video_loops/${currentVideo}`}
                        className="absolute inset-0 w-full h-full object-cover z-0"
                        autoPlay
                        loop
                        muted
                        playsInline
                        crossOrigin="anonymous"
                    />
                )}

                {/* Album Art Mode */}
                {visualizerName === 'album art' && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        {currentTrack.album_art_path ? (
                            <img 
                                src={`http://localhost:8000/${currentTrack.album_art_path}`} 
                                alt="Album Art" 
                                className="max-w-[70vw] max-h-[70vh] w-auto h-auto rounded-lg shadow-[0_0_100px_rgba(0,0,0,0.8)] object-contain"
                            />
                        ) : (
                            <div className="w-[40vh] h-[40vh] bg-neutral-800 rounded-lg flex items-center justify-center shadow-2xl">
                                <span className="text-6xl">♪</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Canvas for Wavis (Hidden if None or Album Art) */}
                <canvas 
                    ref={canvasRef} 
                    className={`absolute inset-0 w-full h-full z-10 ${visualizerName === 'none' || visualizerName === 'album art' ? 'hidden' : ''}`} 
                />
                
                {/* Visualizer Controls (Top Right) */}
                <div className={`absolute top-8 right-8 z-20 flex gap-4 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    
                    {/* Visualizer Selection */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowVizMenu(!showVizMenu); setShowVideoMenu(false); }}
                            className={`bg-black/40 hover:bg-white/20 p-3 rounded-full text-white backdrop-blur-md border border-white/20 hover:scale-110 transition-all ${showVizMenu ? 'bg-white/20' : ''}`}
                            title="Select Visualizer"
                        >
                            <FaMagic size={20} className={visualizerName === 'shockwave' ? 'text-purple-400' : 'text-white'} />
                        </button>
                        
                        {showVizMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-[#181818]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 z-50">
                                {visualizerOptions.map((v) => (
                                    <button
                                        key={v}
                                        onClick={(e) => { e.stopPropagation(); selectVisualizer(v); }}
                                        className={`w-full text-left px-4 py-3 text-sm font-bold capitalize transition-colors flex items-center justify-between ${visualizerName === v ? 'text-green-400 bg-white/5' : 'text-white hover:bg-white/10'}`}
                                    >
                                        {v}
                                        {visualizerName === v && <div className="w-2 h-2 rounded-full bg-green-400"></div>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Background Video Selection */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowVideoMenu(!showVideoMenu); setShowVizMenu(false); }}
                            className={`bg-black/40 hover:bg-white/20 p-3 rounded-full text-white backdrop-blur-md border border-white/20 hover:scale-110 transition-all ${showVideoMenu ? 'bg-white/20' : ''}`}
                            title="Select Background Video"
                        >
                            <FaVideo size={20} className={currentVideo ? 'text-blue-400' : 'text-white'} />
                        </button>
                        
                        {showVideoMenu && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-[#181818]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 z-50 max-h-80 overflow-y-auto">
                                <button
                                    onClick={(e) => { e.stopPropagation(); selectVideo(null); }}
                                    className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors flex items-center justify-between ${!currentVideo ? 'text-green-400 bg-white/5' : 'text-white hover:bg-white/10'}`}
                                >
                                    None (Black)
                                    {!currentVideo && <div className="w-2 h-2 rounded-full bg-green-400"></div>}
                                </button>
                                {availableVideos.map((video) => (
                                    <button
                                        key={video}
                                        onClick={(e) => { e.stopPropagation(); selectVideo(video); }}
                                        className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors flex items-center justify-between ${currentVideo === video ? 'text-green-400 bg-white/5' : 'text-white hover:bg-white/10'}`}
                                    >
                                        <span className="truncate">{video}</span>
                                        {currentVideo === video && <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 ml-2"></div>}
                                    </button>
                                ))}
                                {availableVideos.length === 0 && (
                                    <div className="px-4 py-3 text-sm text-gray-400 italic">No videos found in assets/video_loops</div>
                                )}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsFullScreen(false); }}
                        className="bg-black/40 hover:bg-white/20 p-3 rounded-full text-white backdrop-blur-md border border-white/20 hover:scale-110 transition-all"
                    >
                        <FaCompressAlt size={20} />
                    </button>
                </div>

                {/* Center Overlay Content - Minimalist */}
                <div className={`absolute inset-x-0 bottom-0 pb-16 z-20 flex flex-col items-center justify-end transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="text-center max-w-2xl px-8" onClick={(e) => e.stopPropagation()}>
                        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] line-clamp-2">{currentTrack.title}</h1>
                        <h2 className="text-xl md:text-3xl text-cyan-300 font-medium mb-10 drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] truncate">{currentTrack.artist}</h2>

                        {/* Controls */}
                        <div className="flex items-center justify-center gap-12 backdrop-blur-md bg-black/30 p-6 rounded-full border border-white/10 shadow-2xl">
                             <button onClick={onPrev} disabled={!hasPrev} className={`text-white/70 hover:text-white transition-transform hover:scale-110 active:scale-95 ${!hasPrev && 'opacity-30'}`}>
                                <FaStepBackward size={32} />
                            </button>
                            <button
                                className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.6)] active:scale-95"
                                onClick={onTogglePlay}
                            >
                                {isPlaying ? <FaPause size={24} /> : <FaPlay size={24} className="ml-1" />}
                            </button>
                            <button onClick={onNext} disabled={!hasNext} className={`text-white/70 hover:text-white transition-transform hover:scale-110 active:scale-95 ${!hasNext && 'opacity-30'}`}>
                                <FaStepForward size={32} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Standard Footer Player */}
            <div className="fixed bottom-0 left-0 right-0 bg-black text-white px-4 h-[90px] flex items-center justify-between z-[90] border-t border-[#282828]">
                <audio
                    ref={audioRef}
                    src={`http://localhost:8000/tracks/${currentTrack.id}/stream`}
                    crossOrigin="anonymous"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleTrackEnd}
                    onError={(e) => {
                        console.error("Audio Playback Error:", e);
                    }}
                />

                {/* Left: Track Info */}
                <div className="flex items-center gap-4 w-[30%] min-w-[180px]">
                    <div className="relative group w-14 h-14 bg-[#282828] rounded shadow-lg overflow-hidden flex-shrink-0">
                        {currentTrack.album_art_path ? (
                            <img src={`http://localhost:8000/${currentTrack.album_art_path}`} alt="Album Art" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                <span className="text-xs text-gray-400">♪</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => setIsFullScreen(true)}>
                            <button className="text-white hover:text-green-400 transform hover:scale-110 transition-all">
                                <FaExpandAlt size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-hidden min-w-0 flex flex-col justify-center">
                        <Link to={`/track/${currentTrack.id}`} className="font-medium text-sm text-white hover:underline truncate">
                            {currentTrack.title}
                        </Link>
                        <span className="text-xs text-[#b3b3b3] truncate hover:text-white hover:underline cursor-pointer">
                            {currentTrack.artist}
                        </span>
                    </div>
                    <button 
                        onClick={toggleFavorite} 
                        className={`ml-2 text-[#b3b3b3] hover:text-white ${isFavorite ? 'text-green-500 hover:text-green-400' : ''}`}
                    >
                        {isFavorite ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
                    </button>
                </div>

                {/* Center: Controls */}
                <div className="flex flex-col items-center max-w-[40%] w-full gap-1">
                    <div className="flex items-center gap-6 mb-1">
                        <button className="text-[#b3b3b3] hover:text-white transition-colors" title="Shuffle (Coming soon)">
                            <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor" className="opacity-70"><path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75 13.15.922zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z"></path><path d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z"></path></svg>
                        </button>
                        <button 
                            className={`text-[#b3b3b3] hover:text-white transition-colors ${!hasPrev ? 'opacity-30 cursor-not-allowed' : ''}`}
                            onClick={onPrev}
                            disabled={!hasPrev}
                        >
                            <FaStepBackward size={20} />
                        </button>
                        <button
                            className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
                            onClick={onTogglePlay}
                        >
                            {isPlaying ? <FaPause size={12} /> : <FaPlay size={12} className="ml-0.5" />}
                        </button>
                        <button 
                            className={`text-[#b3b3b3] hover:text-white transition-colors ${!hasNext ? 'opacity-30 cursor-not-allowed' : ''}`}
                            onClick={onNext}
                            disabled={!hasNext}
                        >
                            <FaStepForward size={20} />
                        </button>
                        <button className="text-[#b3b3b3] hover:text-white transition-colors" title="Repeat (Coming soon)">
                            <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor" className="opacity-70"><path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75h-8.5A3.75 3.75 0 0 1 0 9.75v-5zm3.75-2.25a2.25 2.25 0 0 0-2.25 2.25v5c0 1.243 1.008 2.25 2.25 2.25h8.5a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5z"></path></svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-2 w-full text-xs font-medium text-[#b3b3b3] group">
                        <span className="min-w-[40px] text-right">{formatTime(currentTime)}</span>
                        <div className="relative flex-1 h-1 bg-[#4d4d4d] rounded-full group-hover:h-1.5 transition-all">
                            <div 
                                className="absolute top-0 left-0 h-full bg-white group-hover:bg-[#1db954] rounded-full"
                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                            ></div>
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                        <span className="min-w-[40px]">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right: Volume & Extra */}
                <div className="flex items-center justify-end gap-2 w-[30%]">
                    <div className="flex items-center gap-2 w-32 group">
                        <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="text-[#b3b3b3] hover:text-white">
                            {volume === 0 ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
                        </button>
                        <div className="relative flex-1 h-1 bg-[#4d4d4d] rounded-full">
                            <div 
                                className="absolute top-0 left-0 h-full bg-[#b3b3b3] group-hover:bg-[#1db954] rounded-full"
                                style={{ width: `${volume * 100}%` }}
                            ></div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Player;
