import React, { useState, useRef, useEffect } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';

const Player = ({ currentTrack, isPlaying, setIsPlaying, onTogglePlay, onNext, onPrev, hasNext, hasPrev }) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const audioRef = useRef(null);
    const navigate = useNavigate();

    // Audio visualizer refs
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const canvasRef = useRef(null);
    const miniCanvasRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                // Resume AudioContext if it exists and is suspended (browser autoplay policy)
                if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume();
                }
                
                audioRef.current.play().catch(e => console.error("Playback failed:", e));
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, currentTrack]);

    // Set up audio context and visualizer
    useEffect(() => {
        if (audioRef.current && !audioContextRef.current) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioContextRef.current = new AudioContext();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 64;
                analyserRef.current.smoothingTimeConstant = 0.8;

                sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
                sourceRef.current.connect(analyserRef.current);
                analyserRef.current.connect(audioContextRef.current.destination);
            } catch (e) {
                console.error("Failed to create audio context:", e);
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    // Draw visualizer
    useEffect(() => {
        const drawVisualizer = () => {
            if (!analyserRef.current) {
                animationRef.current = requestAnimationFrame(drawVisualizer);
                return;
            }

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            // Draw main canvas
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                const barCount = 16;
                const barWidth = canvas.width / barCount - 1;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                for (let i = 0; i < barCount; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                    gradient.addColorStop(0, '#22c55e');
                    gradient.addColorStop(1, '#4ade80');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(i * (barWidth + 1), canvas.height - barHeight, barWidth, barHeight);
                }
            }

            // Draw mini canvas on album art
            if (miniCanvasRef.current && isPlaying) {
                const canvas = miniCanvasRef.current;
                const ctx = canvas.getContext('2d');
                const barCount = 8;
                const barWidth = canvas.width / barCount - 1;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                for (let i = 0; i < barCount; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    ctx.fillStyle = '#22c55e';
                    ctx.fillRect(i * (barWidth + 1), canvas.height - barHeight, barWidth, barHeight);
                }
            }

            animationRef.current = requestAnimationFrame(drawVisualizer);
        };

        drawVisualizer();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying]);

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
        <div className="fixed bottom-0 left-0 right-0 glass-player text-white p-4 h-24 flex items-center justify-between z-50 px-6">
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
            <div className="flex items-center gap-4 w-1/3">
                <div className="w-14 h-14 bg-[#282828] rounded-md shadow-lg overflow-hidden flex-shrink-0 relative">
                    {currentTrack.album_art_path ? (
                        <img src={`http://localhost:8000/${currentTrack.album_art_path}`} alt="Album Art" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                            <span className="text-xs text-gray-400">No Art</span>
                        </div>
                    )}
                    {/* Mini Visualizer on album art */}
                    {isPlaying && (
                        <canvas
                            ref={miniCanvasRef}
                            width={56}
                            height={12}
                            className="absolute bottom-0 left-0 right-0 bg-black/50"
                        />
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
                    className="rounded"
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
    );
};

export default Player;
