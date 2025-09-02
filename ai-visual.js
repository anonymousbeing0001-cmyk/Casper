// Simple animated "brain" visual for Casper
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.zIndex = '-1';
const ctx = canvas.getContext('2d');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

let nodes = Array.from({length:50}, ()=>({x:Math.random()*canvas.width, y:Math.random()*canvas.height, dx:(Math.random()-0.5)*2, dy:(Math.random()-0.5)*2}));

function animate() {
    ctx.fillStyle='rgba(0,0,0,0.1)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='pink';
    nodes.forEach(n=>{
        n.x+=n.dx; n.y+=n.dy;
        if(n.x<0||n.x>canvas.width) n.dx*=-1;
        if(n.y<0||n.y>canvas.height) n.dy*=-1;
        nodes.forEach(m=>{ 
            if(n!==m){
                let d=Math.hypot(n.x-m.x,n.y-m.y);
                if(d<100){ ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(m.x,m.y); ctx.stroke();}
            }
        });
    });
    requestAnimationFrame(animate);
}
animate();