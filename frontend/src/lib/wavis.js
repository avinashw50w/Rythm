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
        
        // Visualizer state
        this.hue = 0;
        
        this.visualizers = {};
        this.currentVisualizer = 'bars';
        this.presets = this.getPresets();
        
        // Bind handlers once to avoid memory leaks
        this.resize = this.resize.bind(this);
        
        // Initialize presets
        Object.keys(this.presets).forEach(key => {
            this.addVisualizer(key, this.presets[key]);
        });
    }

    getVisualizers() {
        return Object.keys(this.visualizers);
    }

    init() {
        if (this.audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.85; // Smoother transition

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
        window.addEventListener('resize', this.resize);
    }

    unmount() {
        this.stop();
        window.removeEventListener('resize', this.resize);
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
        if (!this.canvas || !this.ctx || !this.analyser) {
            this.stop();
            return;
        }

        this.animationId = requestAnimationFrame(this.animate.bind(this));

        // Update Frequency Data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Update Color Hue
        this.hue = (this.hue + 0.5) % 360;

        // Clear Canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // No background fill to allow video pass-through
        // The container div has bg-black for fallback

        // Render current visualizer
        const renderFn = this.visualizers[this.currentVisualizer];
        if (renderFn) {
            this.ctx.save();
            // Reset common styles
            this.ctx.shadowBlur = 0;
            this.ctx.globalCompositeOperation = 'source-over';
            
            renderFn(this.ctx, this.canvas, this.dataArray, this.bufferLength, this.hue);
            this.ctx.restore();
        }
    }

    getPresets() {
        return {
            bars: (ctx, canvas, data, len, hue) => {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const barWidth = (canvas.width / len) * 8; 
                let x = 0;
                
                // Dynamic Gradient
                const gradient = ctx.createLinearGradient(0, cy + 200, 0, cy - 200);
                gradient.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
                gradient.addColorStop(0.5, `hsl(${hue + 60}, 100%, 60%)`);
                gradient.addColorStop(1, '#ffffff');
                ctx.fillStyle = gradient;
                
                // Glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = `hsl(${hue + 60}, 100%, 50%)`;

                const usefulLen = Math.floor(len * 0.7);

                for (let i = 0; i < usefulLen; i++) {
                    const value = data[i];
                    const barHeight = (value / 255) * (canvas.height * 0.6);
                    
                    if (barHeight > 0) {
                        ctx.fillRect(cx + x, cy - barHeight / 2, barWidth, barHeight);
                        ctx.fillRect(cx - x - barWidth, cy - barHeight / 2, barWidth, barHeight);
                    }
                    x += barWidth + 1;
                }
            },
            
            wave: (ctx, canvas, data, len, hue) => {
                ctx.lineWidth = 3;
                ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                ctx.shadowBlur = 15;
                ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;

                ctx.beginPath();
                
                const sliceWidth = canvas.width / (len * 0.4);
                let x = 0;

                for(let i = 0; i < len * 0.4; i++) {
                    const v = data[i] / 255.0;
                    const y = (canvas.height / 2) + Math.sin(i * 0.1) * (v * canvas.height * 0.4);
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);

                    x += sliceWidth;
                }
                
                ctx.stroke();
            },

            circle: (ctx, canvas, data, len, hue) => {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const radius = Math.min(cx, cy) * 0.3;
                
                ctx.translate(cx, cy);
                
                const bars = 180;
                const step = (Math.PI * 2) / bars;
                
                for (let i = 0; i < bars; i++) {
                    const dataIndex = Math.floor(i * (len / 2) / bars);
                    const value = data[dataIndex];
                    const barHeight = (value / 255) * 200;
                    
                    ctx.save();
                    ctx.rotate(i * step);
                    
                    // Rotating colors
                    const barHue = (hue + (i * 2)) % 360;
                    ctx.fillStyle = `hsl(${barHue}, 100%, 60%)`;
                    
                    if (barHeight > 5) {
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = `hsl(${barHue}, 100%, 50%)`;
                        ctx.fillRect(0, radius, 4, barHeight); 
                    }
                    
                    ctx.restore();
                }
            },

            dots: (ctx, canvas, data, len, hue) => {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const maxRadius = Math.min(cx, cy) * 0.9;
                
                let bass = 0;
                for(let i=0; i<10; i++) bass += data[i];
                bass = bass / 10;
                
                // Pulsing Background
                ctx.beginPath();
                ctx.arc(cx, cy, maxRadius * 0.2 + (bass * 0.8), 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${hue + 180}, 100%, 50%, ${bass/1000})`;
                ctx.fill();

                const particles = 120;
                for (let i = 0; i < particles; i++) {
                    const dataIndex = Math.floor(i * (len / 3) / particles);
                    const value = data[dataIndex];
                    
                    const angle = (i / particles) * Math.PI * 2;
                    const dist = (maxRadius * 0.3) + (value / 255) * (maxRadius * 0.5);
                    
                    const x = cx + Math.cos(angle) * dist;
                    const y = cy + Math.sin(angle) * dist;
                    
                    const size = (value / 255) * 8;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fillStyle = `hsl(${hue + (i)}, 100%, 70%)`;
                    
                    if (value > 150) {
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = `hsl(${hue + (i)}, 100%, 50%)`;
                    } else {
                        ctx.shadowBlur = 0;
                    }
                    
                    ctx.fill();
                }
            },

            shockwave: (ctx, canvas, data, len, hue) => {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                
                // Calculate bass energy
                let bass = 0;
                for(let i=0; i<20; i++) bass += data[i];
                bass /= 20;
                const normBass = bass / 255; // 0 to 1

                ctx.translate(cx, cy);
                
                // 1. Core Energy Ball
                ctx.beginPath();
                const coreSize = 50 + (normBass * 100);
                ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
                ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
                ctx.shadowBlur = 30;
                ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
                ctx.fill();
                
                // 2. Mid-Range Reactive Ring (Rotating)
                ctx.save();
                ctx.rotate(Date.now() / 2000); // Slow constant rotation
                ctx.beginPath();
                const ringRadius = coreSize + 40;
                
                // Draw a jagged circle based on frequency
                const segments = 120;
                for (let i = 0; i <= segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    // Map segment to frequency data (mid-range: 40-160)
                    const dataIdx = 40 + i; 
                    const val = data[dataIdx] || 0;
                    
                    // Radius variation
                    const r = ringRadius + (val * 0.5);
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.lineWidth = 4;
                ctx.strokeStyle = `hsl(${hue + 180}, 100%, 70%)`;
                ctx.shadowBlur = 15;
                ctx.shadowColor = `hsl(${hue + 180}, 100%, 60%)`;
                ctx.stroke();
                ctx.restore();

                // 3. High Frequency Bursts/Beams
                const beams = 12;
                for(let i=0; i<beams; i++) {
                    ctx.save();
                    // Static angles
                    ctx.rotate((Math.PI * 2 / beams) * i);
                    
                    // High freq data
                    const highFreqVal = data[200 + i * 5]; 
                    if (highFreqVal > 100) {
                        const beamLen = highFreqVal * 1.5;
                        ctx.fillStyle = `hsla(${hue + 60}, 100%, 80%, ${highFreqVal/255})`;
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = 'white';
                        // Draw beam extending from ring
                        ctx.fillRect(ringRadius + 20, -2, beamLen, 4);
                    }
                    ctx.restore();
                }
            }
        };
    }
}