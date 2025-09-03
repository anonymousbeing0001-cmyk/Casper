// ai-visual.js

const canvas = document.getElementById('aiCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];

// Particle class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 1;
        this.color = color;
        this.speedX = (Math.random() - 0.5) * 2;
        this.speedY = (Math.random() - 0.5) * 2;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.size > 0.1) this.size -= 0.02;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Create burst of particles on new message
function createParticles(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Animate particles
function animate() {
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; // fading trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].size <= 0.1) {
            particles.splice(i, 1);
            i--;
        }
    }
    requestAnimationFrame(animate);
}

// Initialize animation
animate();

// Listen for Casper responses via WebSocket
const ws = new WebSocket(`ws://${window.location.host}`);
ws.addEventListener('open', () => console.log('AI Visual WebSocket connected.'));
ws.addEventListener('message', event => {
    const message = event.data;
    if (message.startsWith('Casper:')) {
        // Visual effect at random position
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        createParticles(x, y, `hsl(${Math.random() * 360}, 80%, 60%)`, 30);
    }
});

// Optional: react to mouse movement for interactivity
canvas.addEventListener('mousemove', e => {
    createParticles(e.clientX, e.clientY, 'rgba(255,255,255,0.7)', 2);
});