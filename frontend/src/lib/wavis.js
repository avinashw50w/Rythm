
export default class Wavis {
    constructor(audioElement) {
        this.audioElement = audioElement;
        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.bufferLength = 0;
        
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        
        this.visualizers = {};
        this.currentVisualizer = 'bars';
        this.presets = this.getPresets();
        
        // Initialize presets
        Object.keys(this.presets).forEach(key => {
            this.addVisualizer(key, this.presets[key]);
        });
    }

    init() {
        if (this.audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.85; // Smoother transition

        // Handle potential CORS issues with media elements
        try {
            // Check if source already exists to avoid error
            if (!this.source) {
                this.source = this.audioCtx.createMediaElementSource(this.audioElement);
                this.source.connect(this.analyser);
                this.analyser.connect(this.audioCtx.destination);
            }
        } catch (e) {
            console.warn("Wavis: Media source already connected or CORS error", e);
        }

        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
    }

    mount(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', this.resize.bind(this));
    }

    unmount() {
        this.stop();
        window.removeEventListener('resize', this.resize.bind(this));
        this.canvas = null;
        this.ctx = null;
    }

    resize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    }

    addVisualizer(name, renderFn) {
        this.visualizers[name] = renderFn;
    }

    setVisualizer(name) {
        if (this.visualizers[name]) {
            this.currentVisualizer = name;
        }
    }

    nextVisualizer() {
        const keys = Object.keys(this.visualizers);
        const currentIndex = keys.indexOf(this.currentVisualizer);
        const nextIndex = (currentIndex + 1) % keys.length;
        this.currentVisualizer = keys[nextIndex];
        return this.currentVisualizer;
    }

    start() {
        this.init();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        if (!this.animationId) {
            this.animate();
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    animate() {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        if (!this.ctx || !this.analyser) return;

        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Clear canvas with a slight fade for trail effect if needed, but clean clear looks sharper for neon
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Background
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render current visualizer
        const renderFn = this.visualizers[this.currentVisualizer];
        if (renderFn) {
            this.ctx.save();
            renderFn(this.ctx, this.canvas, this.dataArray, this.bufferLength);
            this.ctx.restore();
        }
    }

    getPresets() {
        return {
            bars: (ctx, canvas, data, len) => {
                // Inspired by Image 1: Mirrored bars with cyan/purple gradient
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const barWidth = (canvas.width / len) * 8; 
                let x = 0;
                
                // Neon Gradient
                const gradient = ctx.createLinearGradient(0, cy + 200, 0, cy - 200);
                gradient.addColorStop(0, '#bd34fe'); // Purple
                gradient.addColorStop(0.5, '#41d1ff'); // Blue
                gradient.addColorStop(1, '#ffffff'); // White tip
                ctx.fillStyle = gradient;
                
                // Glow
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#41d1ff';

                // Skip some high frequencies
                const usefulLen = Math.floor(len * 0.7);

                for (let i = 0; i < usefulLen; i++) {
                    const value = data[i];
                    // Amplify height
                    const barHeight = (value / 255) * (canvas.height * 0.6);
                    
                    // Mirrored Center
                    if (barHeight > 0) {
                        ctx.fillRect(cx + x, cy - barHeight / 2, barWidth, barHeight);
                        ctx.fillRect(cx - x - barWidth, cy - barHeight / 2, barWidth, barHeight);
                    }
                    x += barWidth + 1; // Spacing
                }
            },
            
            wave: (ctx, canvas, data, len) => {
                // Inspired by Image 2 & 4: Smooth neon flowing wave
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#1ed760';
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Neon Glow
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#1ed760';

                ctx.beginPath();
                
                const sliceWidth = canvas.width / (len * 0.4);
                let x = 0;

                // Draw curve
                for(let i = 0; i < len * 0.4; i++) {
                    const v = data[i] / 255.0;
                    const y = (canvas.height / 2) + Math.sin(i * 0.15) * (v * canvas.height * 0.4);
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else {
                        const prevX = x - sliceWidth;
                        const prevY = (canvas.height / 2) + Math.sin((i - 1) * 0.15) * (data[i - 1] / 255.0 * canvas.height * 0.4);
                        const cpX = (prevX + x) / 2;
                        const cpY = (prevY + y) / 2;
                        ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
                    }

                    x += sliceWidth;
                }
                
                ctx.stroke();
                
                // Fill gradient under wave
                ctx.lineTo(canvas.width, canvas.height);
                ctx.lineTo(0, canvas.height);
                ctx.closePath();
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, 'rgba(30, 215, 96, 0.0)');
                gradient.addColorStop(1, 'rgba(30, 215, 96, 0.2)');
                ctx.fillStyle = gradient;
                ctx.fill();
            },

            circle: (ctx, canvas, data, len) => {
                // Inspired by Image 2 (Radial): Circular frequency spectrum
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const radius = Math.min(cx, cy) * 0.3;
                
                ctx.translate(cx, cy);
                
                const bars = 180;
                const step = (Math.PI * 2) / bars;
                
                for (let i = 0; i < bars; i++) {
                    // Map bars to frequency data, focusing on lower/mid
                    const dataIndex = Math.floor(i * (len / 2) / bars);
                    const value = data[dataIndex];
                    const barHeight = (value / 255) * 180;
                    
                    ctx.save();
                    ctx.rotate(i * step);
                    
                    // Rainbow Neon Aesthetic
                    const hue = (i / bars) * 360;
                    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
                    
                    // Draw bar extending outwards
                    // Use small rectangles for a "digital" look
                    if (barHeight > 5) {
                        ctx.fillRect(0, radius, 3, barHeight); 
                    }
                    
                    // Inner reflection
                    ctx.fillStyle = `hsla(${hue}, 100%, 70%, 0.2)`;
                    if (barHeight > 5) {
                        ctx.fillRect(0, radius - (barHeight * 0.2) - 5, 2, barHeight * 0.2);
                    }
                    
                    ctx.restore();
                }
            },

            dots: (ctx, canvas, data, len) => {
                // Inspired by Image 3: Particles/Dots Matrix
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const maxRadius = Math.min(cx, cy) * 0.9;
                
                // Calculate average bass for center pulse
                let bass = 0;
                for(let i=0; i<10; i++) bass += data[i];
                bass = bass / 10;
                
                // Pulsing Background
                ctx.beginPath();
                ctx.arc(cx, cy, maxRadius * 0.2 + (bass * 0.8), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(138, 43, 226, ${bass/1200})`; // Violet pulse
                ctx.fill();

                const particles = 120;
                for (let i = 0; i < particles; i++) {
                    const dataIndex = Math.floor(i * (len / 3) / particles); // use lower third of freq
                    const value = data[dataIndex];
                    
                    const angle = (i / particles) * Math.PI * 2;
                    // Distance fluctuates with volume
                    const dist = (maxRadius * 0.3) + (value / 255) * (maxRadius * 0.5);
                    
                    const x = cx + Math.cos(angle) * dist;
                    const y = cy + Math.sin(angle) * dist;
                    
                    const size = (value / 255) * 6;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    // Blue-Pink gradient coloring
                    ctx.fillStyle = `hsl(${(i/particles)*60 + 280}, 100%, 70%)`;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = `hsl(${(i/particles)*60 + 280}, 100%, 50%)`;
                    ctx.fill();
                }
            },

            shockwave: (ctx, canvas, data, len) => {
                // Dramatic bass shockwaves
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                
                // Calculate bass energy
                let bass = 0;
                for(let i=0; i<10; i++) bass += data[i];
                bass /= 10;
                const normBass = bass / 255; // 0 to 1
                const scale = 1 + normBass * 0.5;

                ctx.translate(cx, cy);
                
                // Inner solid core
                ctx.beginPath();
                ctx.arc(0, 0, 60 * scale, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${normBass})`;
                ctx.shadowBlur = 40 * normBass;
                ctx.shadowColor = '#bd34fe'; // Purple glow
                ctx.fill();

                // Concentric Rings
                ctx.lineWidth = 3;
                ctx.shadowBlur = 20;
                
                // Ring 1
                ctx.beginPath();
                ctx.arc(0, 0, 100 * scale, 0, Math.PI * 2);
                ctx.strokeStyle = '#41d1ff';
                ctx.shadowColor = '#41d1ff';
                ctx.stroke();
                
                // Ring 2 (Deformed)
                ctx.beginPath();
                // Create a slightly jagged circle based on freq data
                for (let i = 0; i < 360; i+=10) {
                    const angle = (i * Math.PI) / 180;
                    const val = data[i % 60]; 
                    const r = (140 * scale) + (val * 0.2);
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    if (i===0) ctx.moveTo(x,y);
                    else ctx.lineTo(x,y);
                }
                ctx.closePath();
                ctx.strokeStyle = `rgba(189, 52, 254, 0.8)`;
                ctx.shadowColor = '#bd34fe';
                ctx.stroke();

                // Beams/Rays
                const rays = 16;
                for(let i=0; i<rays; i++) {
                    ctx.save();
                    ctx.rotate((Math.PI * 2 / rays) * i + (Date.now() / 1000)); // Rotate slowly
                    const rayLen = data[i * 4] * 2;
                    
                    ctx.fillStyle = '#fff';
                    // Draw beam
                    if (rayLen > 50) {
                        ctx.globalAlpha = rayLen / 512; // fade out
                        ctx.fillRect(180, -1, rayLen * 0.8, 2);
                    }
                    ctx.restore();
                }
            }
        };
    }
}
