class BitcoinPriceTracker {
    constructor() {
        this.ws = null;
        this.currentPrice = null;
        this.previousPrice = null;
        this.bullOpacity = 0.3;  // Default opacity
        this.bearOpacity = 0.3;  // Default opacity
        this.currentSentiment = null; // Track current active sentiment: 'bull', 'bear', or null
        console.log('BitcoinPriceTracker constructor initialized');
        this.init();
    }

    init() {
        this.connectWebSocket();
    }

    connectWebSocket() {
        try {
            if (this.ws) {
                this.ws.close();
            }

            this.ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

            this.ws.onopen = () => {
                console.log('WebSocket connected to Binance');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Raw WebSocket data received:', data);

                    // Binance WebSocket format: {"e":"trade","E":1640995200000,"s":"BTCUSDT","p":"43123.00000000","q":"0.00000000","b":0,"a":0,"T":0,"m":false,"M":true}
                    if (data && data.p) {
                        const price = parseFloat(data.p);
                        if (!isNaN(price) && price > 0) {
                            console.log('Valid BTC price extracted:', price);
                            this.updatePrice(price);
                        } else {
                            console.warn('Invalid price value:', data.p, 'Parsed as:', price);
                        }
                    } else {
                        console.warn('Missing price data in WebSocket message:', data);
                    }
                } catch (parseError) {
                    console.error('Error parsing WebSocket data:', parseError, 'Raw data:', event.data);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                setTimeout(() => {
                    this.connectWebSocket();
                }, 3000);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

        } catch (error) {
            console.error('Failed to connect to Binance WebSocket:', error);
        }
    }

    updatePrice(price) {
        const oldPrice = this.currentPrice;
        this.previousPrice = this.currentPrice;
        this.currentPrice = price;
        console.log('Price updated - Old:', oldPrice, 'Previous:', this.previousPrice, 'Current:', this.currentPrice);

        // Update sentiment based on price movement - only trigger on significant changes
        if (this.previousPrice !== null && this.previousPrice !== undefined) {
            const priceDiff = Math.abs(this.currentPrice - this.previousPrice);
            const threshold = 1.0; // Minimum $1 change to trigger animal response
            console.log('Price difference calculation:', this.currentPrice, '-', this.previousPrice, '=', priceDiff);
            console.log('Price difference:', priceDiff, 'Threshold:', threshold);

            if (priceDiff >= threshold) {
                const direction = this.currentPrice > this.previousPrice ? 'UP' : 'DOWN';
                console.log(`Price moved ${direction} by $${priceDiff.toFixed(2)} - triggering animal response`);

                if (this.currentPrice > this.previousPrice) {
                    // Price went up significantly - activate bull, deactivate bear
                    this.bullOpacity = 0.8;
                    this.bearOpacity = 0.3;
                    this.currentSentiment = 'bull';
                    console.log('✅ Bull market detected - activating bull');

                    // Trigger particle burst effect
                    if (this.particleSystem) {
                        this.particleSystem.triggerBurst(1.5);
                    }
                } else if (this.currentPrice < this.previousPrice) {
                    // Price went down significantly - activate bear, deactivate bull
                    this.bearOpacity = 0.8;
                    this.bullOpacity = 0.3;
                    this.currentSentiment = 'bear';
                    console.log('✅ Bear market detected - activating bear');

                    // Trigger particle burst effect
                    if (this.particleSystem) {
                        this.particleSystem.triggerBurst(1.5);
                    }
                }
            } else {
                console.log(`❌ Price change ($${priceDiff.toFixed(2)}) below threshold ($${threshold}) - maintaining current sentiment`);
            }
        } else {
            console.log('First price update - setting baseline');
        }

        this.updateDisplay();
    }

    updateDisplay() {
        const priceElement = document.getElementById('price');
        const formattedPrice = this.formatPrice(this.currentPrice);
        priceElement.textContent = formattedPrice;

        // Update SVG opacities and active states
        const bullContainer = document.querySelector('.bull-container');
        const bearContainer = document.querySelector('.bear-container');

        console.log('DOM elements found:', {
            priceElement: !!priceElement,
            bullContainer: !!bullContainer,
            bearContainer: !!bearContainer
        });

        if (bullContainer && bearContainer) {
            // Remove active class from both
            bullContainer.classList.remove('active');
            bearContainer.classList.remove('active');

            // Add active class to the current sentiment animal
            if (this.currentSentiment === 'bull') {
                bullContainer.classList.add('active');
                console.log('Bull activated - Price:', this.currentPrice);
            } else if (this.currentSentiment === 'bear') {
                bearContainer.classList.add('active');
                console.log('Bear activated - Price:', this.currentPrice);
            }

            // Update opacities
            bullContainer.style.opacity = this.bullOpacity;
            bearContainer.style.opacity = this.bearOpacity;

            // Update particle system sentiment
            if (this.particleSystem) {
                this.particleSystem.updateSentiment(this.currentSentiment);
            }

            console.log('Bull opacity:', this.bullOpacity, 'Bear opacity:', this.bearOpacity, 'Sentiment:', this.currentSentiment);
        } else {
            console.error('DOM elements not found!');
        }
    }

    formatPrice(price) {
        return '$' + Math.floor(price).toLocaleString('en-US');
    }
}

class ParticleSystem {
    constructor() {
        this.canvas = document.getElementById('particles-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationId = null;
        this.sentiment = 'neutral'; // 'bull', 'bear', 'neutral'
        this.particleCount = 80;
        this.transitionDuration = 60; // frames for smooth transition
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.oldSentiment = 'neutral';
        this.colors = {
            neutral: ['#F7931A', '#FFD700', '#FFA500'],
            bull: ['#00ff00', '#32CD32', '#90EE90', '#F7931A'],
            bear: ['#ff0000', '#DC143C', '#FF6347', '#F7931A']
        };

        this.init();
    }


    getResponsiveParticleSize() {
        const width = window.innerWidth;

        if (width <= 480) {
            // Mobile portrait - smaller particles
            return Math.random() * 2 + 0.5; // 0.5px to 2.5px
        } else if (width <= 768) {
            // Mobile landscape and small tablets
            return Math.random() * 2.5 + 0.8; // 0.8px to 3.3px
        } else if (width <= 1024) {
            // Tablets
            return Math.random() * 2.8 + 1; // 1px to 3.8px
        } else {
            // Desktop - original size
            return Math.random() * 3 + 1; // 1px to 4px
        }
    }

    init() {
        this.resizeCanvas();
        this.createParticles();
        this.animate();

        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: this.getResponsiveParticleSize(),
                opacity: Math.random() * 0.5 + 0.2,
                color: this.colors.neutral[Math.floor(Math.random() * this.colors.neutral.length)],
                life: Math.random() * 100 + 50,
                maxLife: Math.random() * 100 + 50,
                // Transition properties for smooth velocity changes
                targetVx: 0,
                targetVy: 0,
                originalVx: 0,
                originalVy: 0
            });
        }
    }

    updateParticles() {
        // Handle smooth sentiment transition
        if (this.isTransitioning) {
            this.transitionProgress++;

            if (this.transitionProgress >= this.transitionDuration) {
                // Transition complete
                this.isTransitioning = false;
                this.transitionProgress = 0;
                console.log('Smooth transition completed');
            }
        }

        this.particles.forEach(particle => {
            // Handle velocity transition if active
            if (this.isTransitioning && particle.originalVx !== undefined) {
                const progress = this.transitionProgress / this.transitionDuration;
                const easeProgress = this.easeInOutCubic(progress);

                // Smoothly interpolate between original and target velocity
                particle.vx = particle.originalVx + (particle.targetVx - particle.originalVx) * easeProgress;
                particle.vy = particle.originalVy + (particle.targetVy - particle.originalVy) * easeProgress;
            }

            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Wrap around screen edges
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;

            // Update life
            particle.life--;
            if (particle.life <= 0) {
                particle.life = particle.maxLife;
                // Reset position when particle "dies"
                particle.x = Math.random() * this.canvas.width;
                particle.y = Math.random() * this.canvas.height;

                // Clear transition properties when particle resets
                particle.targetVx = 0;
                particle.targetVy = 0;
                particle.originalVx = 0;
                particle.originalVy = 0;
            }

            // Update opacity based on life
            const lifeRatio = particle.life / particle.maxLife;
            particle.opacity = lifeRatio * 0.6 + 0.1;

            // Update color based on sentiment
            const colorArray = this.colors[this.sentiment] || this.colors.neutral;
            particle.color = colorArray[Math.floor(Math.random() * colorArray.length)];
        });
    }

    drawParticles() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.opacity;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    animate() {
        this.updateParticles();
        this.drawParticles();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateSentiment(sentiment) {
        const newSentiment = sentiment || 'neutral';

        // Start smooth transition if sentiment is changing
        if (newSentiment !== this.sentiment && !this.isTransitioning) {
            this.oldSentiment = this.sentiment;
            this.sentiment = newSentiment;
            this.isTransitioning = true;
            this.transitionProgress = 0;

            // Store target velocities for each particle
            this.particles.forEach(particle => {
                particle.targetVx = (Math.random() - 0.5) * 0.5;
                particle.targetVy = (Math.random() - 0.5) * 0.5;
                particle.originalVx = particle.vx;
                particle.originalVy = particle.vy;
            });

            console.log(`Starting smooth transition from ${this.oldSentiment} to ${this.sentiment}`);
        } else if (!this.isTransitioning) {
            // Just update sentiment without transition if no change or already transitioning
            this.sentiment = newSentiment;
        }

        console.log('Particle system sentiment updated to:', this.sentiment);
    }

    // Easing function for smooth transitions
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    // Method to trigger particle burst effect on price changes
    triggerBurst(intensity = 1) {
        this.particles.forEach(particle => {
            // Give particles a burst of speed
            particle.vx *= (1 + intensity * 0.1);
            particle.vy *= (1 + intensity * 0.1);

            // Reset life for more visible effect
            particle.life = particle.maxLife;
            particle.opacity = Math.min(1, particle.opacity + intensity * 0.3);
        });
    }
}

// Fullscreen toggle function
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    } else {
        document.exitFullscreen().catch(err => {
            console.error('Error attempting to exit fullscreen:', err);
        });
    }
}

// Update fullscreen button icon based on fullscreen state
function updateFullscreenButton() {
    const btn = document.getElementById('fullscreen-btn');
    const svg = btn.querySelector('svg');

    if (document.fullscreenElement) {
        // Currently in fullscreen - show exit icon
        svg.innerHTML = '<path d="M5 16H8V19H5V16ZM8 8H5V5H8V8ZM19 8V5H16V8H19ZM16 16H19V19H16V16Z" fill="currentColor"/>';
    } else {
        // Not in fullscreen - show enter icon
        svg.innerHTML = '<path d="M8 3V5H4V9H2V3H8ZM2 21V15H4V19H8V21H2ZM22 21H16V19H20V15H22V21ZM22 9H20V5H16V3H22V9Z" fill="currentColor"/>';
    }
}

// Listen for fullscreen changes to update button icon
document.addEventListener('fullscreenchange', updateFullscreenButton);

document.addEventListener('DOMContentLoaded', () => {
    const bitcoinTracker = new BitcoinPriceTracker();
    const particleSystem = new ParticleSystem();

    // Expose particle system to bitcoin tracker for integration
    bitcoinTracker.particleSystem = particleSystem;
});
