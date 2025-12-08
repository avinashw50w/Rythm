import React, { useState, useRef, useEffect } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaVolumeMute, FaExpandAlt, FaCompressAlt, FaHeart, FaRegHeart } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import * as THREE from 'three';
import client from '../api/client';
import { useUI } from '../context/UIContext';

const Player = ({ currentTrack, isPlaying, setIsPlaying, onTogglePlay, onNext, onPrev, hasNext, hasPrev }) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isFavorite, setIsFavorite] = useState(false);
    
    const audioRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const { showToast } = useUI();

    // Audio API refs
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const dataArrayRef = useRef(null);

    // Canvas refs
    const fullScreenMountRef = useRef(null); // Div to mount Three.js

    // Three.js refs
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const animationFrameRef = useRef(null);
    const barsMeshRef = useRef(null);
    const albumArtMeshRef = useRef(null);
    const starsRef = useRef(null);
    const groupRef = useRef(null);

    useEffect(() => {
        if (currentTrack) {
            setIsFavorite(currentTrack.is_favorite);
        }
    }, [currentTrack]);

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

    // Initialize Audio Context (Lazy)
    const initAudioContext = () => {
        if (!audioContextRef.current && audioRef.current) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                audioContextRef.current = ctx;

                const analyser = ctx.createAnalyser();
                analyser.fftSize = 2048; // High resolution for better visualizer
                analyser.smoothingTimeConstant = 0.85;
                analyserRef.current = analyser;

                dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

                const source = ctx.createMediaElementSource(audioRef.current);
                sourceRef.current = source;

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

    // Handle full-screen mouse movement to show/hide controls
    useEffect(() => {
        if (!isFullScreen) {
            setShowControls(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            return;
        }

        const resetControlsTimeout = () => {
            setShowControls(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        };

        // Initial set
        resetControlsTimeout();

        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [isFullScreen]);

    const handleFullScreenMouseMove = () => {
        if (!isFullScreen) return;
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    };

    // --- Three.js Visualizer Lifecycle: INIT ---
    useEffect(() => {
        if (!isFullScreen || !fullScreenMountRef.current) return;

        // Initialize Scene
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.03); // More fog for depth
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 24;
        camera.position.y = 2;
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        fullScreenMountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Group to hold the circle and bars for global rotation/scaling
        const mainGroup = new THREE.Group();
        scene.add(mainGroup);
        groupRef.current = mainGroup;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);
        
        // Dynamic lights
        const spotLight = new THREE.SpotLight(0xbd34fe, 100);
        spotLight.position.set(0, 20, 10);
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.5;
        scene.add(spotLight);

        const pointLight = new THREE.PointLight(0x41d1ff, 5, 50);
        pointLight.position.set(0, -10, 10);
        scene.add(pointLight);

        // --- Create Objects ---

        // 1. Circular Spectrum Bars (InstancedMesh)
        const barsCount = 120; // More bars for a smoother look
        const barWidth = 0.4;
        const radius = 10;
        
        const geometry = new THREE.BoxGeometry(barWidth, 1, barWidth);
        geometry.translate(0, 0.5, 0); // Pivot at bottom
        
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.9,
            emissive: 0x000000,
            emissiveIntensity: 0.5
        });
        
        const barsMesh = new THREE.InstancedMesh(geometry, material, barsCount);
        const dummy = new THREE.Object3D();
        const angleStep = (Math.PI * 2) / barsCount;

        for (let i = 0; i < barsCount; i++) {
            const angle = i * angleStep;
            dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
            dummy.rotation.z = angle - Math.PI / 2; // Rotate outward from center
            dummy.updateMatrix();
            barsMesh.setMatrixAt(i, dummy.matrix);
            
            // Initial gradient color (Cyan to Purple)
            const color = new THREE.Color();
            color.setHSL(i / barsCount, 1, 0.5);
            barsMesh.setColorAt(i, color);
        }
        barsMesh.instanceMatrix.needsUpdate = true;
        barsMesh.instanceColor.needsUpdate = true;
        mainGroup.add(barsMesh); // Add to group
        barsMeshRef.current = barsMesh;

        // 2. Center Album Art Disc (Geometry only, texture set in separate effect)
        const discRadius = radius - 1.5;
        const artGeometry = new THREE.CylinderGeometry(discRadius, discRadius, 0.2, 64);
        artGeometry.rotateX(Math.PI / 2); // Face Z axis
        
        const artMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x111111, // Default dark grey
            roughness: 0.4,
            metalness: 0.2
        });
        
        const artMesh = new THREE.Mesh(artGeometry, [
            new THREE.MeshBasicMaterial({ color: 0x000000 }), // Side
            artMaterial, // Top (Index 1) - This is where the texture goes
            new THREE.MeshBasicMaterial({ color: 0x000000 })  // Bottom
        ]);
        mainGroup.add(artMesh);
        albumArtMeshRef.current = artMesh;

        // 3. Glowing Ring (behind bars)
        const ringGeo = new THREE.TorusGeometry(radius, 0.05, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x41d1ff });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        mainGroup.add(ring);

        // 4. Starfield / Particles
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 2000;
        const posArray = new Float32Array(starsCount * 3);
        const sizesArray = new Float32Array(starsCount);
        
        for(let i = 0; i < starsCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 150; // Wide spread
        }
        for(let i = 0; i < starsCount; i++) {
            sizesArray[i] = Math.random();
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizesArray, 1));
        
        // Simple circle shader for particles
        const sprite = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png');
        const starsMaterial = new THREE.PointsMaterial({
            size: 0.5,
            map: sprite,
            transparent: true,
            alphaTest: 0.5,
            vertexColors: false,
            color: 0xffffff,
            opacity: 0.6
        });
        
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(stars);
        starsRef.current = stars;

        // --- Animation Loop ---
        const dummyUpdate = new THREE.Object3D();
        const colorUpdate = new THREE.Color();
        const purple = new THREE.Color(0xbd34fe);
        const cyan = new THREE.Color(0x41d1ff);

        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            let bassImpulse = 1;

            if (analyserRef.current && dataArrayRef.current) {
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                const data = dataArrayRef.current;
                
                // Audio Data Processing
                // We want to skip the very first few bins (DC offset/rumble) and spread the rest
                const lowerBound = 4; 
                const range = 150; // Focus on 0-~3000Hz where most energy is
                const step = Math.floor(range / barsCount);

                let sumBass = 0;

                for (let i = 0; i < barsCount; i++) {
                    const dataIndex = lowerBound + (i * step);
                    // Average a few bins for smoothness
                    const val = (data[dataIndex] + data[dataIndex+1]) / 2; 
                    
                    // Normalize (0-1)
                    const normVal = val / 255;

                    // Calculate Bass for global pulse (first 10% of bars)
                    if (i < barsCount / 8) {
                        sumBass += normVal;
                    }

                    // Visual Scale
                    // Non-linear scaling looks better (square the normalized value)
                    const scaleVal = 0.2 + (normVal * normVal * normVal * 15); 

                    // Update Position/Scale
                    const angle = i * angleStep;
                    dummyUpdate.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
                    dummyUpdate.rotation.z = angle - Math.PI / 2;
                    dummyUpdate.scale.set(1, scaleVal, 1);
                    dummyUpdate.updateMatrix();
                    barsMesh.setMatrixAt(i, dummyUpdate.matrix);

                    // Dynamic Color
                    // Interpolate between purple (low) and cyan/white (high) based on volume of that bar
                    colorUpdate.copy(purple).lerp(cyan, i / barsCount).lerp(new THREE.Color(0xffffff), normVal * 0.8);
                    barsMesh.setColorAt(i, colorUpdate);
                }
                
                barsMesh.instanceMatrix.needsUpdate = true;
                barsMesh.instanceColor.needsUpdate = true;

                // Global Pulse
                const bassAvg = sumBass / (barsCount / 8);
                bassImpulse = 1 + (bassAvg * 0.15); // Subtle pulse
            }

            // Apply Pulse to Center Group
            if (groupRef.current) {
                // Smooth lerp for pulse to avoid jitter
                const currentScale = groupRef.current.scale.x;
                const targetScale = bassImpulse;
                const smoothScale = currentScale + (targetScale - currentScale) * 0.2;
                
                groupRef.current.scale.set(smoothScale, smoothScale, smoothScale);
                groupRef.current.rotation.z += 0.001; // Slow constant rotation
            }

            // Particles Drift
            if (starsRef.current) {
                starsRef.current.rotation.y += 0.0003;
                starsRef.current.rotation.x -= 0.0001;
            }

            // Camera movement
            const time = Date.now() * 0.0002;
            camera.position.x = Math.sin(time) * 2;
            camera.position.y = Math.cos(time * 0.5) * 2;
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
        };

        animate();

        const handleResize = () => {
            if (cameraRef.current && rendererRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
                if (fullScreenMountRef.current && rendererRef.current.domElement) {
                    try {
                        fullScreenMountRef.current.removeChild(rendererRef.current.domElement);
                    } catch (e) {
                        console.warn("Could not remove canvas", e);
                    }
                }
                rendererRef.current = null;
            }
            
            // Dispose Geometries/Materials
            geometry.dispose();
            material.dispose();
            artGeometry.dispose();
            artMaterial.dispose();
            starsGeometry.dispose();
            starsMaterial.dispose();
            ringGeo.dispose();
            ringMat.dispose();
        };

    }, [isFullScreen]); 

    // --- Three.js Visualizer Lifecycle: TRACK UPDATE ---
    useEffect(() => {
        if (!isFullScreen || !albumArtMeshRef.current || !currentTrack) return;

        // Dispose old texture to free memory
        const material = albumArtMeshRef.current.material[1]; // Top face
        if (material.map) {
            material.map.dispose();
        }

        const updateTexture = (texture) => {
            if (!albumArtMeshRef.current) return;
            texture.colorSpace = THREE.SRGBColorSpace;
            albumArtMeshRef.current.material[1].map = texture;
            albumArtMeshRef.current.material[1].needsUpdate = true;
        };

        if (currentTrack.album_art_path) {
            const loader = new THREE.TextureLoader();
            loader.load(
                `http://localhost:8000/${currentTrack.album_art_path}`,
                updateTexture,
                undefined,
                (err) => console.error("Error loading texture:", err)
            );
        } else {
            // Generate fallback texture
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // Gradient Background
            const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
            grad.addColorStop(0, '#333');
            grad.addColorStop(1, '#000');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);
            
            // Text/Icon
            ctx.fillStyle = '#41D1FF';
            ctx.font = 'bold 200px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♪', 256, 256);
            
            // Song Title (Small)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px Arial';
            ctx.fillText(currentTrack.title.substring(0, 15), 256, 400);

            const texture = new THREE.CanvasTexture(canvas);
            updateTexture(texture);
        }

    }, [currentTrack, isFullScreen]);


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

    if (!currentTrack) return null;

    return (
        <>
            {/* Full Screen Visualizer Overlay */}
            <div 
                className={`fixed inset-0 z-[100] bg-black transition-all duration-700 ease-in-out ${isFullScreen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'} ${!showControls ? 'cursor-none' : ''}`}
                onMouseMove={handleFullScreenMouseMove}
                onClick={handleFullScreenMouseMove}
            >
                {/* Three.js Mount Point */}
                <div ref={fullScreenMountRef} className="absolute inset-0 w-full h-full" />
                
                {/* Top Controls */}
                <div className={`absolute top-8 right-8 z-20 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsFullScreen(false); }}
                        className="bg-white/10 hover:bg-white/20 p-3 rounded-full text-white backdrop-blur-md transition-all border border-white/20 hover:rotate-90 duration-300"
                    >
                        <FaCompressAlt size={24} />
                    </button>
                </div>

                {/* Center Overlay Content - Minimalist */}
                <div className={`absolute inset-x-0 bottom-0 pb-16 z-10 flex flex-col items-center justify-end transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="text-center max-w-2xl px-8" onClick={(e) => e.stopPropagation()}>
                        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-pulse-slow">{currentTrack.title}</h1>
                        <h2 className="text-xl md:text-3xl text-cyan-300 font-medium mb-10 drop-shadow-[0_0_10px_rgba(65,209,255,0.5)]">{currentTrack.artist}</h2>

                        {/* Controls */}
                        <div className="flex items-center justify-center gap-12 backdrop-blur-md bg-black/20 p-6 rounded-full border border-white/10 shadow-2xl">
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