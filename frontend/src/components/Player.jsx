import React, { useState, useRef, useEffect } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaVolumeMute, FaExpandAlt, FaCompressAlt } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';

const Player = ({ currentTrack, isPlaying, setIsPlaying, onTogglePlay, onNext, onPrev, hasNext, hasPrev }) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isFullScreen, setIsFullScreen] = useState(false);
    
    const audioRef = useRef(null);
    const navigate = useNavigate();

    // Audio visualizer refs
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const canvasRef = useRef(null);
    const miniCanvasRef = useRef(null);
    const fullScreenCanvasRef = useRef(null);
    const animationRef = useRef(null);
    const dataArrayRef = useRef(null);

    // Initialize Audio Context (Lazy)
    const initAudioContext = () => {
        if (!audioContextRef.current && audioRef.current) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                audioContextRef.current = ctx;

                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256; // Higher resolution for full screen
                analyser.smoothingTimeConstant = 0.85; // Smoother transition
                analyserRef.current = analyser;

                // Create array for data once
                dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

                // Create source from audio element
                const source = ctx.createMediaElementSource(audioRef.current);
                sourceRef.current = source;

                // Connect graph: Source -> Analyser -> Destination (Speakers)
                source.connect(analyser);
                analyser.connect(ctx.destination);
            } catch (e) {
                console.error("Failed to initialize audio context:", e);
            }
        }
    };

    // Handle Playback & Context Resume
    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                initAudioContext();
                if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume().catch(e => console.error("Ctx resume failed", e));
                }
                audioRef.current.play().catch(e => console.error("Playback failed:", e));
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, currentTrack]);

    // Handle Window Resize for Full Screen Canvas
    useEffect(() => {
        const handleResize = () => {
            if (isFullScreen && fullScreenCanvasRef.current) {
                fullScreenCanvasRef.current.width = window.innerWidth;
                fullScreenCanvasRef.current.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        // Trigger once when opening
        if (isFullScreen) handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [isFullScreen]);

    // Visualizer Loop
    useEffect(() => {
        const drawVisualizer = () => {
            if (!analyserRef.current || !dataArrayRef.current) {
                animationRef.current = requestAnimationFrame(drawVisualizer);
                return;
            }

            const analyser = analyserRef.current;
            const dataArray = dataArrayRef.current;
            
            // Get frequency data
            analyser.getByteFrequencyData(dataArray);

            // 1. Draw Mini Footer Canvas (Bar Graph)
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                // Use fewer bars for the small view
                const bufferLength = dataArray.length; 
                const step = Math.floor(bufferLength / 16); 

                ctx.clearRect(0, 0, width, height);

                for (let i = 0; i < 16; i++) {
                    const value = dataArray[i * step];
                    const barHeight = (value / 255) * height;
                    const x = i * (width / 16);
                    
                    const gradient = ctx.createLinearGradient(0, height, 0, 0);
                    gradient.addColorStop(0, '#22c55e'); 
                    gradient.addColorStop(1, '#4ade80');

                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, height - barHeight, (width/16) - 2, barHeight);
                }
            }

            // 2. Draw Mini Album Overlay (Simple Wave)
            if (miniCanvasRef.current && isPlaying) {
                const canvas = miniCanvasRef.current;
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                const bufferLength = dataArray.length;
                const step = Math.floor(bufferLength / 8);

                ctx.clearRect(0, 0, width, height);
                for (let i = 0; i < 8; i++) {
                    const value = dataArray[i * step];
                    const barHeight = (value / 255) * height;
                    ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
                    ctx.fillRect(i * (width/8), height - barHeight, (width/8) - 1, barHeight);
                }
            }

            // 3. Draw Full Screen Circular Visualizer
            if (isFullScreen && fullScreenCanvasRef.current) {
                const canvas = fullScreenCanvasRef.current;
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                const centerX = width / 2;
                const centerY = height / 2;
                const radius = Math.min(width, height) / 4; // Base radius for the circle
                
                // Clear screen with a slight fade for trail effect
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fillRect(0, 0, width, height);

                const bufferLength = 120; // Limit bars for cleaner look
                const barWidth = (Math.PI * 2) / bufferLength; 
                
                // Calculate bass kick for center circle scaling
                let bassTotal = 0;
                for(let i=0; i<10; i++) bassTotal += dataArray[i];
                const bassScale = 1 + (bassTotal / 10 / 255) * 0.2;

                // Draw Center Glow behind album art (handled by CSS, but we can add canvas glow)
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * bassScale, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fill();
                ctx.restore();

                // Draw Circular Spectrum
                for (let i = 0; i < bufferLength; i++) {
                    const value = dataArray[i]; // Spectrum value
                    // Scale bar height based on bass
                    const barHeight = (value / 255) * (Math.min(width, height) / 3); 
                    
                    const angle = i * barWidth - (Math.PI / 2); // Start from top

                    // Coordinates on the circle circumference
                    const x1 = centerX + Math.cos(angle) * (radius * bassScale + 10);
                    const y1 = centerY + Math.sin(angle) * (radius * bassScale + 10);
                    
                    // Coordinates at the end of the bar
                    const x2 = centerX + Math.cos(angle) * (radius * bassScale + 10 + barHeight);
                    const y2 = centerY + Math.sin(angle) * (radius * bassScale + 10 + barHeight);

                    ctx.strokeStyle = `hsl(${i * 3 + 260}, 100%, 50%)`; // Purple to Green spectrum
                    ctx.lineWidth = 4;
                    ctx.lineCap = 'round';
                    
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }

                // Optional: Draw subtle particles
                // (Simplified for performance: random dots based on high frequencies)
                const highFreqIndex = Math.floor(bufferLength * 0.7);
                if (dataArray[highFreqIndex] > 100) {
                    ctx.fillStyle = '#fff';
                    const rx = Math.random() * width;
                    const ry = Math.random() * height;
                    ctx.fillRect(rx, ry, 2, 2);
                }
            }

            animationRef.current = requestAnimationFrame(drawVisualizer);
        };

        if (isPlaying) {
            drawVisualizer();
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, isFullScreen]);

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

    if (!currentTrack) return null;

    return (
        <>
            {/* Full Screen Visualizer Overlay */}
            <div className={`fixed inset-0 z-[100] bg-black transition-all duration-500 ease-in-out flex flex-col items-center justify-center ${isFullScreen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
                {/* Background Canvas */}
                <canvas ref={fullScreenCanvasRef} className="absolute inset-0 w-full h-full" />
                
                {/* Top Controls */}
                <div className="absolute top-8 right-8 z-20">
                    <button 
                        onClick={() => setIsFullScreen(false)}
                        className="bg-white/10 hover:bg-white/20 p-3 rounded-full text-white backdrop-blur-md transition-all"
                    >
                        <FaCompressAlt size={24} />
                    </button>
                </div>

                {/* Center Content */}
                <div className="relative z-10 flex flex-col items-center text-center p-8 animate-fade-in">
                    <div className="relative mb-8">
                        {/* Glowing Ring Effect behind Art */}
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-green-500 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                        <div className="w-64 h-64 md:w-96 md:h-96 rounded-full overflow-hidden shadow-2xl border-4 border-white/10 relative z-10">
                             {currentTrack.album_art_path ? (
                                <img src={`http://localhost:8000/${currentTrack.album_art_path}`} alt="Album Art" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-700">
                                    <span className="text-6xl">♪</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-lg">{currentTrack.title}</h1>
                    <h2 className="text-2xl md:text-3xl text-gray-300 font-medium mb-12">{currentTrack.artist}</h2>

                    {/* Big Controls */}
                    <div className="flex items-center gap-12">
                         <button onClick={onPrev} disabled={!hasPrev} className={`text-white/70 hover:text-white transition-transform hover:scale-110 ${!hasPrev && 'opacity-30'}`}>
                            <FaStepBackward size={40} />
                        </button>
                        <button
                            className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                            onClick={onTogglePlay}
                        >
                            {isPlaying ? <FaPause size={32} /> : <FaPlay size={32} className="ml-2" />}
                        </button>
                        <button onClick={onNext} disabled={!hasNext} className={`text-white/70 hover:text-white transition-transform hover:scale-110 ${!hasNext && 'opacity-30'}`}>
                            <FaStepForward size={40} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Standard Footer Player */}
            <div className="fixed bottom-0 left-0 right-0 glass-player text-white p-4 h-24 flex items-center justify-between z-50 px-6 border-t border-[#333]">
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

                {/* Track Info */}
                <div className="flex items-center gap-4 w-1/3 min-w-0">
                    <div className="w-14 h-14 bg-[#282828] rounded-md shadow-lg overflow-hidden flex-shrink-0 relative group">
                        {currentTrack.album_art_path ? (
                            <img src={`http://localhost:8000/${currentTrack.album_art_path}`} alt="Album Art" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                                <span className="text-xs text-gray-400">No Art</span>
                            </div>
                        )}
                        
                        {/* Mini Visualizer Overlay */}
                        {isPlaying && (
                            <div className="absolute bottom-0 left-0 right-0 h-4 bg-black/40 backdrop-blur-[1px]">
                                <canvas
                                    ref={miniCanvasRef}
                                    width={56}
                                    height={16}
                                    className="w-full h-full"
                                />
                            </div>
                        )}

                        {/* Expand Button Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                                onClick={() => setIsFullScreen(true)}
                                className="text-white hover:text-green-400 transform hover:scale-110 transition-all"
                                title="Full Screen Visualizer"
                            >
                                <FaExpandAlt size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-hidden min-w-0">
                        <Link to={`/track/${currentTrack.id}`} className="font-bold text-sm truncate hover:underline cursor-pointer block text-white">
                            {currentTrack.title}
                        </Link>
                        <div className="text-xs text-gray-400 truncate">{currentTrack.artist}</div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-center gap-2 w-1/3">
                    <div className="flex items-center gap-6">
                        <button 
                            className={`text-gray-400 hover:text-white transition-colors ${!hasPrev ? 'opacity-30 cursor-not-allowed' : ''}`}
                            onClick={onPrev}
                            disabled={!hasPrev}
                        >
                            <FaStepBackward size={18} />
                        </button>
                        <button
                            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
                            onClick={onTogglePlay}
                        >
                            {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} className="ml-1" />}
                        </button>
                        <button 
                            className={`text-gray-400 hover:text-white transition-colors ${!hasNext ? 'opacity-30 cursor-not-allowed' : ''}`}
                            onClick={onNext}
                            disabled={!hasNext}
                        >
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

                {/* Volume & Visualizer */}
                <div className="flex items-center justify-end gap-4 w-1/3">
                    {/* Canvas Visualizer */}
                    <canvas
                        ref={canvasRef}
                        width={96}
                        height={32}
                        className="rounded opacity-50"
                    />

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
        </>
    );
};

export default Player;