
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
            this.source = this.audioCtx.createMediaElementSource(this.audioElement);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
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
        
        // Clear canvas
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
                const barWidth = (canvas.width / len) * 2.5;
                let barHeight;
                let x = 0;
                
                // Gradient
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                gradient.addColorStop(0, '#bd34fe');
                gradient.addColorStop(0.5, '#41d1ff');
                gradient.addColorStop(1, '#ffffff');
                ctx.fillStyle = gradient;

                for (let i = 0; i < len; i++) {
                    barHeight = data[i] * (canvas.height / 255) * 0.8;
                    // Mirror reflection effect
                    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight); 
                    x += barWidth + 1;
                    if(x > canvas.width) break;
                }
            },
            
            wave: (ctx, canvas, data, len) => {
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#1ed760';
                ctx.beginPath();

                const sliceWidth = canvas.width * 1.0 / len;
                let x = 0;

                // Smooth curve
                // We use a subset of data for cleaner wave in frequency domain, 
                // but usually waves are TimeDomain. Let's fake a nice curve from Frequency data
                // or assume we want the "landscape" look from the images.
                
                // Let's create a filled mountain-scape
                ctx.moveTo(0, canvas.height);
                for(let i = 0; i < len; i++) {
                    const v = data[i] / 255.0;
                    const y = canvas.height - (v * canvas.height * 0.8);
                    
                    // Smooth quadratic curves would be better, but lineTo is faster
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);

                    x += sliceWidth * 2; // Stretch
                    if (x > canvas.width) break;
                }
                
                ctx.lineTo(canvas.width, canvas.height);
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, 'rgba(30, 215, 96, 0.8)');
                gradient.addColorStop(1, 'rgba(30, 215, 96, 0)');
                ctx.fillStyle = gradient;
                ctx.fill();
                ctx.stroke();
            },

            circle: (ctx, canvas, data, len) => {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const radius = Math.min(cx, cy) * 0.4;
                
                ctx.translate(cx, cy);
                
                // Draw circular bars
                const bars = 180;
                const step = (Math.PI * 2) / bars;
                
                // Use bass frequencies primarily
                const dataStep = Math.floor(len / bars);

                for (let i = 0; i < bars; i++) {
                    const value = data[i * dataStep];
                    const barHeight = (value / 255) * (radius * 0.8);
                    
                    ctx.save();
                    ctx.rotate(i * step);
                    
                    // Neon colors
                    const hue = (i / bars) * 360;
                    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
                    
                    ctx.fillRect(0, radius, 4, barHeight); // Outer
                    ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.3)`;
                    ctx.fillRect(0, radius - (barHeight * 0.5), 4, barHeight * 0.5); // Inner reflection
                    
                    ctx.restore();
                }
            },

            mirror: (ctx, canvas, data, len) => {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const barWidth = 6;
                const bars = Math.floor(canvas.width / barWidth);
                
                for (let i = 0; i < bars / 2; i++) {
                    const value = data[i * 2]; // Skip some data
                    const height = (value / 255) * (canvas.height * 0.6);
                    
                    const r = value + 50;
                    const g = 255 - value;
                    const b = 200;
                    
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    
                    // Right side
                    ctx.fillRect(cx + (i * barWidth), cy - height / 2, barWidth - 1, height);
                    // Left side
                    ctx.fillRect(cx - ((i + 1) * barWidth), cy - height / 2, barWidth - 1, height);
                }
                
                // Center glow
                ctx.globalCompositeOperation = 'lighter';
                const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, canvas.width / 2);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            },

            shockwave: (ctx, canvas, data, len) => {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                
                // Calculate bass energy
                let bass = 0;
                for(let i=0; i<10; i++) bass += data[i];
                bass /= 10;
                const scale = 1 + (bass / 255) * 0.5;

                ctx.translate(cx, cy);
                ctx.scale(scale, scale);
                
                ctx.beginPath();
                ctx.arc(0, 0, 100, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 65, 209, ${(bass/255)})`;
                ctx.lineWidth = 10;
                ctx.stroke();
                
                ctx.beginPath();
                ctx.arc(0, 0, 150 + (bass * 0.5), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(65, 209, 255, ${(bass/255) * 0.5})`;
                ctx.lineWidth = 5;
                ctx.stroke();

                // Rays
                const rays = 32;
                for(let i=0; i<rays; i++) {
                    ctx.save();
                    ctx.rotate((Math.PI * 2 / rays) * i);
                    const rayLen = data[i * 4] * 1.5;
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(100, -2, rayLen, 4);
                    ctx.restore();
                }
            }
        };
    }
}
