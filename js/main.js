// Generate starfield
const starsEl = document.getElementById('stars');
for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    s.style.cssText = `
        width:${size}px; height:${size}px;
        left:${Math.random()*100}%;
        top:${Math.random()*100}%;
        --op:${Math.random()*0.7+0.1};
        --dur:${Math.random()*3+2}s;
        animation-delay:${Math.random()*4}s;
    `;
    starsEl.appendChild(s);
}

// Launch game with fade transition
const overlay = document.createElement('div');
overlay.className = 'launch-overlay';
document.body.appendChild(overlay);

function launchGame(url) {
    overlay.classList.add('active');
    setTimeout(() => { window.location.href = url; }, 350);
}
