'use strict';

// ── INJECT goalkeeper2 img if not in HTML ───────────────
(function() {
    if (!document.getElementById('keeperStand2')) {
        const keeperEl = document.getElementById('keeper');
        if (keeperEl) {
            const img = document.createElement('img');
            img.className = 'keeper-img';
            img.id = 'keeperStand2';
            img.src = '../../assets/images/penalty/goalkeeper2.png';
            img.alt = 'GK2';
            keeperEl.insertBefore(img, keeperEl.querySelector('#keeperUp'));
        }
    }
})();

// ── CONFIG ──────────────────────────────────────────────
const TOTAL_ROUNDS = 5;
const KEEPER_ACCURACY  = [0.30, 0.35, 0.40, 0.42, 0.48];
const BOT_SHOT_WEIGHTS = [2,1,2, 1,0,1, 3,1,3];

const ZONE_POS = [
    { l:17, b:30 }, { l:50, b:42 }, { l:83, b:35 },
    { l:6,  b:18 }, { l:50, b:10 }, { l:84, b:16 },
    { l:16, b:-10 },{ l:50, b:1  }, { l:84, b:-10 },
];

// Vị trí bóng riêng — chỉnh độc lập với thủ môn
const BALL_ZONE_POS = [
    { l:17, b:55 }, { l:50, b:55 }, { l:83, b:55 },  // hàng trên: ↖ ↑ ↗
    { l:10, b:18 }, { l:50, b:10 }, { l:100, b:16 },  // hàng giữa: ← · →
    { l:16, b:10 },{ l:50, b:1  }, { l:84, b:10 }, // hàng dưới: ↙ ↓ ↘
];

function zoneToDiveDir(zone) {
    const dirs = ['left-up','up','right-up','left','stand','right','left-down','down','right-down'];
    return dirs[zone] ?? 'stand';
}

// ── STATE ───────────────────────────────────────────────
let mode          = 'shooter';
let round         = 0;
let playerScore   = 0;
let botScore      = 0;
let playerHistory = [];
let botHistory    = [];
let busy          = false;

// ── POWER BAR STATE ─────────────────────────────────────
let powerBarActive    = false;
let powerBarValue     = 0;
let powerBarDirection = 1;
let powerBarRAF       = null;
let shootTriggered    = false;

// Multi-key arrow state: track which keys are held
const heldKeys = new Set(); // 'up','down','left','right'

// ── DOM REFS ────────────────────────────────────────────
const screenMode    = document.getElementById('screenMode');
const screenGame    = document.getElementById('screenGame');
const screenResult  = document.getElementById('screenResult');

const playerScoreEl = document.getElementById('playerScore');
const botScoreEl    = document.getElementById('botScore');
const playerDotsEl  = document.getElementById('playerDots');
const botDotsEl     = document.getElementById('botDots');
const sbRoundEl     = document.getElementById('sbRound');
const playerLabel   = document.getElementById('playerLabel');

const keeper         = document.getElementById('keeper');
const keeperStand    = document.getElementById('keeperStand');
const keeperStand2   = document.getElementById('keeperStand2');
const keeperUp       = document.getElementById('keeperUp');
const keeperDown     = document.getElementById('keeperDown');
const keeperLeft     = document.getElementById('keeperLeft');
const keeperRight    = document.getElementById('keeperRight');
const keeperLeftUp   = document.getElementById('keeperLeftUp');
const keeperLeftDown = document.getElementById('keeperLeftDown');
const keeperRightUp  = document.getElementById('keeperRightUp');
const keeperRightDown= document.getElementById('keeperRightDown');

const ALL_KEEPER_IMGS = [
    keeperStand, keeperStand2, keeperUp, keeperDown, keeperLeft, keeperRight,
    keeperLeftUp, keeperLeftDown, keeperRightUp, keeperRightDown
];

// ── KEEPER IDLE ANIMATION ───────────────────────────────
let keeperIdleInterval = null;
let keeperIdleFrame    = 0;   // 0 = goalkeeper.png, 1 = goalkeeper2.png

function startKeeperIdle() {
    stopKeeperIdle();
    keeperIdleFrame = 0;
    keeperStand.classList.add('active');
    keeperStand2 && keeperStand2.classList.remove('active');

    keeperIdleInterval = setInterval(() => {
        keeperIdleFrame = 1 - keeperIdleFrame;
        if (keeperIdleFrame === 0) {
            keeperStand.classList.add('active');
            keeperStand2 && keeperStand2.classList.remove('active');
        } else {
            keeperStand2 && keeperStand2.classList.add('active');
            keeperStand.classList.remove('active');
        }
    }, 600); // swap every 600ms
}

function stopKeeperIdle() {
    if (keeperIdleInterval) { clearInterval(keeperIdleInterval); keeperIdleInterval = null; }
}

const ball          = document.getElementById('ball');
const shooterSprite = document.getElementById('shooterSprite');
const zones         = document.querySelectorAll('.zone');
const actionHint    = document.getElementById('actionHint');
const resultFlash   = document.getElementById('resultFlash');
const resultTrophy  = document.getElementById('resultTrophy');
const resultTitle   = document.getElementById('resultTitle');
const resultSub     = document.getElementById('resultSub');

const powerBarWrap  = document.getElementById('powerBarWrap');
const powerBarFill  = document.getElementById('powerBarFill');
const powerBarLabel = document.getElementById('powerBarLabel');
const arrowDisplay  = document.getElementById('arrowDisplay');
const arrowBtns     = document.querySelectorAll('.arrow-btn');

// ── KEEPER POSE ─────────────────────────────────────────
const ALL_POSE_CLASSES = [
    'pose-up','pose-down','pose-left','pose-right',
    'pose-left-up','pose-left-down','pose-right-up','pose-right-down'
];

function setKeeperPose(dir) {
    ALL_POSE_CLASSES.forEach(c => keeper.classList.remove(c));
    ALL_KEEPER_IMGS.forEach(img => img && img.classList.remove('active'));
    stopKeeperIdle();

    const map = {
        'stand':      { img: keeperStand,     cls: null               },
        'up':         { img: keeperUp,         cls: 'pose-up'         },
        'down':       { img: keeperDown,       cls: 'pose-down'       },
        'left':       { img: keeperLeft,       cls: 'pose-left'       },
        'right':      { img: keeperRight,      cls: 'pose-right'      },
        'left-up':    { img: keeperLeftUp,     cls: 'pose-left-up'    },
        'left-down':  { img: keeperLeftDown,   cls: 'pose-left-down'  },
        'right-up':   { img: keeperRightUp,    cls: 'pose-right-up'   },
        'right-down': { img: keeperRightDown,  cls: 'pose-right-down' },
    };
    const pose = map[dir] || map['stand'];
    if (pose.cls) keeper.classList.add(pose.cls);

    if (dir === 'stand') {
        startKeeperIdle(); // luân phiên 2 ảnh + sway CSS
    } else {
        if (pose.img) pose.img.classList.add('active');
    }
}
setKeeperPose('stand');

// ── SCREENS ─────────────────────────────────────────────
function showScreen(id) {
    [screenMode, screenGame, screenResult].forEach(s =>
        s.classList.toggle('hidden', s.id !== id)
    );
}

// ── START GAME ──────────────────────────────────────────
function startGame(selectedMode) {
    mode          = selectedMode;
    round         = 0;
    playerScore   = 0;
    botScore      = 0;
    playerHistory = [];
    botHistory    = [];
    busy          = false;
    playerLabel.textContent = 'YOU';

    if (mode === 'keeper') {
        zones.forEach(z => { z.onclick = () => keeperTurn(parseInt(z.dataset.zone)); });
    } else {
        zones.forEach(z => { z.onclick = null; });
    }

    if (mode === 'shooter') {
        powerBarWrap.classList.remove('hidden');
        setupKeyControls();
        actionHint.textContent = 'GIỮ [D] TÍCH LỰC + MŨI TÊN CHỌN HƯỚNG';
    } else {
        powerBarWrap.classList.add('hidden');
        removeKeyControls();
        actionHint.textContent = 'CLICK VÀO KHUNG THÀNH ĐỂ BẮT BÓNG';
    }

    updateScoreboard();
    resetBallAndKeeper();
    showScreen('screenGame');
    setTimeout(beginRound, 400);
}

// ── KEY CONTROLS ─────────────────────────────────────────
function setupKeyControls() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
    arrowBtns.forEach(btn => {
        btn.addEventListener('pointerdown', onArrowBtnDown);
        btn.addEventListener('pointerup',   onArrowBtnUp);
        btn.addEventListener('pointerleave',onArrowBtnUp);
    });
    const shootBtn = document.getElementById('shootBtn');
    if (shootBtn) {
        shootBtn.addEventListener('pointerdown', onShootBtnDown);
        shootBtn.addEventListener('pointerup',   onShootBtnUp);
        shootBtn.addEventListener('pointerleave',onShootBtnUp);
    }
}
function removeKeyControls() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup',   onKeyUp);
    heldKeys.clear();
}

// ── DIRECTION HELPERS ────────────────────────────────────
// Combine held keys → composite direction string
function getCompositeDir() {
    const u = heldKeys.has('up'),   d = heldKeys.has('down');
    const l = heldKeys.has('left'), r = heldKeys.has('right');
    if (u && l) return 'up-left';
    if (u && r) return 'up-right';
    if (d && l) return 'down-left';
    if (d && r) return 'down-right';
    if (u) return 'up';
    if (d) return 'down';
    if (l) return 'left';
    if (r) return 'right';
    return null;
}

// Arrow display icon for composite directions
const DIR_ICONS = {
    'up':'↑', 'down':'↓', 'left':'←', 'right':'→',
    'up-left':'↖', 'up-right':'↗', 'down-left':'↙', 'down-right':'↘',
};

function onKeyDown(e) {
    if (busy || mode !== 'shooter') return;
    const arrowMap = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
    if (arrowMap[e.code]) {
        e.preventDefault();
        heldKeys.add(arrowMap[e.code]);
        updateArrowDisplay();
    }
    if (e.code === 'KeyD' && !powerBarActive && !shootTriggered) {
        e.preventDefault();
        startPowerBar();
    }
}

function onKeyUp(e) {
    if (mode !== 'shooter') return;
    const arrowMap = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
    if (arrowMap[e.code]) {
        heldKeys.delete(arrowMap[e.code]);
        updateArrowDisplay();
    }
    if (e.code === 'KeyD' && powerBarActive && !shootTriggered) {
        e.preventDefault();
        releasePowerBar();
    }
}

// Mobile touch arrow buttons — support multi-touch for diagonal
function onArrowBtnDown(e) {
    if (busy || mode !== 'shooter') return;
    e.preventDefault();
    const dir = e.currentTarget.dataset.dir;
    // Handle composite directions (diagonal buttons) directly
    if (dir.includes('-')) {
        // diagonal button: split and add both component keys
        const parts = dir.split('-'); // e.g. ['up','left'] or ['down','right']
        parts.forEach(p => heldKeys.add(p));
    } else {
        heldKeys.add(dir);
    }
    updateArrowDisplay();
}
function onArrowBtnUp(e) {
    e.preventDefault();
    const dir = e.currentTarget.dataset.dir;
    if (dir.includes('-')) {
        const parts = dir.split('-');
        parts.forEach(p => heldKeys.delete(p));
    } else {
        heldKeys.delete(dir);
    }
    updateArrowDisplay();
}
function onShootBtnDown(e) {
    if (busy || mode !== 'shooter' || shootTriggered) return;
    e.preventDefault();
    startPowerBar();
}
function onShootBtnUp(e) {
    if (mode !== 'shooter' || !powerBarActive || shootTriggered) return;
    e.preventDefault();
    releasePowerBar();
}

// ── POWER BAR LOGIC ──────────────────────────────────────
const POWER_SPEED = 0.18;

function startPowerBar() {
    if (powerBarActive || busy) return;
    powerBarActive    = true;
    powerBarValue     = 0;
    powerBarDirection = 1;
    shootTriggered    = false;
    powerBarWrap.classList.add('active');
    actionHint.textContent = 'THẢ [D] ĐỂ SÚT!';
    let lastTime = performance.now();

    function tick(now) {
        const dt = now - lastTime;
        lastTime = now;
        powerBarValue += POWER_SPEED * dt * powerBarDirection;
        if (powerBarValue >= 100) { powerBarValue = 100; powerBarDirection = -1; }
        if (powerBarValue <= 0 && powerBarDirection === -1) { powerBarValue = 0; powerBarDirection = 1; }
        updatePowerBarUI();
        powerBarRAF = requestAnimationFrame(tick);
    }
    powerBarRAF = requestAnimationFrame(tick);
}

function releasePowerBar() {
    if (!powerBarActive) return;
    cancelAnimationFrame(powerBarRAF);
    powerBarActive = false;
    shootTriggered = true;

    const finalPower = powerBarValue;
    const finalDir   = getCompositeDir();

    powerBarWrap.classList.remove('active');
    heldKeys.clear();
    resetArrowDisplay();
    powerBarValue = 0;
    updatePowerBarUI();

    const zone = calcZoneFromPowerAndDir(finalPower, finalDir);
    shooterTurn(zone, finalPower);
}

function updatePowerBarUI() {
    const pct = powerBarValue;
    powerBarFill.style.width = pct + '%';
    let color;
    if      (pct < 50) color = `hsl(${120 - pct * 0.4}, 90%, 52%)`;
    else if (pct < 75) color = `hsl(${100 - (pct-50)*2.8}, 90%, 52%)`;
    else               color = `hsl(${30  - (pct-75)*1.2}, 92%, 52%)`;
    powerBarFill.style.background = color;
    powerBarFill.style.boxShadow  = `0 0 12px ${color}99, 0 0 4px ${color}`;
    if      (pct < 40) powerBarLabel.textContent = 'NHẸ';
    else if (pct < 65) powerBarLabel.textContent = 'VỪA ⚡';
    else if (pct < 85) powerBarLabel.textContent = 'MẠNH 🔥';
    else               powerBarLabel.textContent  = 'NGUY HIỂM ⚠️';
}

function updateArrowDisplay() {
    const dir = getCompositeDir();
    // highlight all held arrow buttons
    arrowBtns.forEach(btn => btn.classList.toggle('active', heldKeys.has(btn.dataset.dir)));
    arrowDisplay.textContent = dir ? (DIR_ICONS[dir] ?? '•') : '•';
}

function resetArrowDisplay() {
    arrowBtns.forEach(btn => btn.classList.remove('active'));
    arrowDisplay.textContent = '•';
}

// ── ZONE CALCULATION ─────────────────────────────────────
// Zones:  0(↖) 1(↑) 2(↗)
//         3(←) 4(·) 5(→)
//         6(↙) 7(↓) 8(↘)
function calcZoneFromPowerAndDir(power, dir) {
    if (power > 85) return -1; // OUT

    // Map composite direction → zone
    const dirZoneMap = {
        'up-left':   0, 'up':    1, 'up-right':   2,
        'left':      3,             'right':       5,
        'down-left': 6, 'down':  7, 'down-right':  8,
    };

    if (dir && dirZoneMap[dir] !== undefined) {
        // Straight down with low power is usually low-center, allow it
        return dirZoneMap[dir];
    }

    // No direction → straight shot; height determined by power
    if (power >= 50) return 1; // center-top
    if (power >= 30) return 4; // center-mid
    return 7;                  // center-low
}

// ── SCOREBOARD ──────────────────────────────────────────
function updateScoreboard() {
    playerScoreEl.textContent = playerScore;
    botScoreEl.textContent    = botScore;
    sbRoundEl.textContent     = round < TOTAL_ROUNDS
        ? `ROUND ${round + 1}/${TOTAL_ROUNDS}` : 'FINAL';
    renderDots(playerDotsEl, playerHistory);
    renderDots(botDotsEl,    botHistory);
}

function renderDots(container, history) {
    container.innerHTML = '';
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const d = document.createElement('div');
        d.className = 'dot' + (history[i] ? ' ' + history[i] : '');
        container.appendChild(d);
    }
}

function setInputEnabled(on) {
    zones.forEach(z => z.style.pointerEvents = on ? 'auto' : 'none');
}

// ── ROUND ───────────────────────────────────────────────
function beginRound() {
    if (round >= TOTAL_ROUNDS) { endGame(); return; }
    busy = false;
    shootTriggered = false;
    powerBarActive = false;
    powerBarValue  = 0;
    heldKeys.clear();
    cancelAnimationFrame(powerBarRAF);
    powerBarWrap.classList.remove('active');
    updatePowerBarUI();
    resetArrowDisplay();
    resetBallAndKeeper();
    clearZoneHighlights();
    updateScoreboard();
    setInputEnabled(true);
    resultFlash.classList.add('hidden');

    if (mode === 'shooter') {
        actionHint.textContent = 'GIỮ [D] TÍCH LỰC + MŨI TÊN CHỌN HƯỚNG';
    } else {
        actionHint.textContent = 'CLICK VÀO KHUNG THÀNH ĐỂ BẮT BÓNG';
    }
}

// ════════════════════════════════════════════════════════
// SHOOTER MODE
// ════════════════════════════════════════════════════════
function shooterTurn(shotZone, power) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';

    if (shotZone === -1) {
        animateShotOut(power, () => {
            playerHistory.push('miss');
            round++;
            updateScoreboard();
            setTimeout(beginRound, 900);
        });
        return;
    }

    const keeperZone = botDecideKeeper(round);
    animateShotToGoal(shotZone, keeperZone, power, (isGoal) => {
        if (isGoal) { playerScore++; playerHistory.push('goal'); }
        else        { playerHistory.push('miss'); }
        round++;
        updateScoreboard();
        setTimeout(beginRound, 900);
    });
}

function botDecideKeeper(r) {
    return Math.floor(Math.random() * 9);
}

// ── Shared shooter run-up animation + callback ───────────
// Phase 1 (0–380ms):  shooter-1 → runup class  (chạy đà, img switches to shooter-2)
// Phase 2 (380–560ms): kicking class            (chân chạm bóng, img switches to shooter-3)
// Phase 3 (560ms+):   onKick() fires + screen shake + impact flash
function runShooterAnim(onKick) {
    const img = shooterSprite.querySelector('img');

    // Reset to shooter-1 (standing)
    shooterSprite.classList.remove('kicking', 'runup', 'impact');
    if (img) img.src = img.src.replace(/shooter(-\d)?\.png/, 'shooter.png');

    // Phase 1 — chạy đà: swap sang shooter-2
    shooterSprite.classList.add('runup');
    if (img) {
        setTimeout(() => {
            img.src = img.src.replace(/shooter(-\d)?\.png/, 'shooter-2.png');
        }, 80); // delay nhỏ để anim runup bắt đầu trước
    }

    // Phase 2 — chân chạm bóng: swap sang shooter-3 + kicking class
    setTimeout(() => {
        shooterSprite.classList.remove('runup');
        shooterSprite.classList.add('kicking');
        if (img) img.src = img.src.replace(/shooter(-\d)?\.png/, 'shooter-3.png');
    }, 380);

    // Phase 3 — impact: screen shake + impact flash + fire callback
    setTimeout(() => {
        shooterSprite.classList.add('impact');
        triggerScreenShake();
        triggerImpactFlash();
        onKick();

        // Reset sprite back to shooter-1 after a moment
        setTimeout(() => {
            shooterSprite.classList.remove('kicking', 'impact');
            if (img) img.src = img.src.replace(/shooter(-\d)?\.png/, 'shooter.png');
        }, 400);
    }, 560);
}

// ── Screen shake ─────────────────────────────────────────
function triggerScreenShake() {
    const field = document.getElementById('field');
    field.classList.remove('screen-shake');
    void field.offsetWidth; // reflow to restart animation
    field.classList.add('screen-shake');
    setTimeout(() => field.classList.remove('screen-shake'), 420);
}

// ── Impact flash (brief white flash overlay) ─────────────
function triggerImpactFlash() {
    let flashEl = document.getElementById('impactFlashOverlay');
    if (!flashEl) {
        flashEl = document.createElement('div');
        flashEl.id = 'impactFlashOverlay';
        flashEl.style.cssText = `
            position:absolute; inset:0; z-index:45; pointer-events:none;
            background:radial-gradient(ellipse 60% 40% at 42% 75%,
                rgba(255,255,220,0.55) 0%, rgba(255,200,0,0.18) 50%, transparent 80%);
            opacity:0;
        `;
        document.getElementById('field').appendChild(flashEl);
    }
    flashEl.style.transition = 'none';
    flashEl.style.opacity    = '1';
    requestAnimationFrame(() => {
        flashEl.style.transition = 'opacity 0.35s ease-out';
        flashEl.style.opacity    = '0';
    });
}

function animateShotOut(power, cb) {
    const fieldRect = document.getElementById('field').getBoundingClientRect();
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const outX = gRect.left - fieldRect.left + gRect.width * (0.3 + Math.random() * 0.4);
    const outY = gRect.top  - fieldRect.top  - 80 - Math.random() * 60;

    runShooterAnim(() => {
        const sx = fieldRect.width  * 0.5;
        const sy = fieldRect.height - fieldRect.height * 0.16;
        const startTime = performance.now();
        const duration  = 420;
        ball.style.transition = 'none';
        ball.classList.add('flying');

        function animFrame(now) {
            const t  = Math.min((now - startTime) / duration, 1);
            const et = easeInOutQuart(t);
            const cx = sx + (outX - sx) * et;
            const cy = sy + (outY - sy) * et - 40 * Math.sin(Math.PI * t);
            ball.style.left   = cx + 'px';
            ball.style.top    = cy + 'px';
            ball.style.bottom = 'auto';
            applyBallPerspective(t, `translateX(-50%) rotate(${t*720}deg)`);
            if (t < 1) { requestAnimationFrame(animFrame); }
            else { showFlash('OUT! ❌', 'miss-flash'); cb(); }
        }
        requestAnimationFrame(animFrame);
    });
}

function animateShotToGoal(shotZone, keeperZone, power, cb) {
    const target    = BALL_ZONE_POS[shotZone];
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const fieldRect = document.getElementById('field').getBoundingClientRect();

    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);

    const speedFactor = 0.6 + (power / 100) * 0.8;
    const duration    = Math.round(480 / speedFactor);

    runShooterAnim(() => {
        keeper.classList.add('diving');
        keeper.style.left   = ZONE_POS[keeperZone].l + '%';
        keeper.style.bottom = ZONE_POS[keeperZone].b + '%';
        setKeeperPose(zoneToDiveDir(keeperZone));

        document.querySelector(`.zone[data-zone="${shotZone}"]`).classList.add('target');

        const sx = fieldRect.width  * 0.5;
        const sy = fieldRect.height - fieldRect.height * 0.16;
        const arcHeight = Math.max(40, (fieldRect.top + fieldRect.height - by) * 0.35);

        ball.style.transition = 'none';
        const startTime = performance.now();
        let totalRot = 0;

        function animFrame(now) {
            const t  = Math.min((now - startTime) / duration, 1);
            const et = easeInOutQuart(t);
            const cx = sx + (bx - sx) * et;
            const arcT = 1 - Math.pow(2*t-1, 2);
            const cy = sy + (by - sy) * et - arcHeight * arcT;
            ball.style.left   = cx + 'px';
            ball.style.top    = cy + 'px';
            ball.style.bottom = 'auto';
            ball.classList.add('flying');
            totalRot = t * 360 * (1.5 + speedFactor * 0.5);
            applyBallPerspective(t, `translateX(-50%) rotate(${totalRot}deg)`);

            if (t < 1) {
                requestAnimationFrame(animFrame);
            } else {
                setTimeout(() => {
                    const saved = isZoneSaved(shotZone, keeperZone);
                    const zEl = document.querySelector(`.zone[data-zone="${shotZone}"]`);
                    zEl.classList.remove('target');
                    if (saved) {
                        zEl.classList.add('saved');
                        showFlash('SAVED! 🧤', 'miss-flash');
                        // Bóng bật ra tay thủ môn rồi nảy tưng tưng
                        animateBallRebound(bx, by, fieldRect, totalRot, () => cb(false));
                    } else {
                        zEl.classList.add('scored');
                        showFlash('GOAL! ⚽', 'goal-flash');
                        // Bóng lăn nhẹ trong lưới rồi dừng
                        animateBallRollInNet(bx, by, totalRot, () => cb(true));
                    }
                }, 60);
            }
        }
        requestAnimationFrame(animFrame);
    });
}

// ── Bóng bật ra khi bị đỡ: rebound vật lý + nảy tưng tưng giảm dần ──
function animateBallRebound(impactX, impactY, fieldRect, startRot, cb) {
    const floorY    = fieldRect.height - fieldRect.height * 0.13; // mặt sân (pixel từ top)
    const bounceDamp = 0.50;   // mỗi lần nảy mất 50% năng lượng nảy dọc
    const rollFric   = 0.82;   // ma sát ngang khi chạm sàn
    const gravity    = 1400;   // px/s²

    // Hướng bật: lệch xuống-dưới về phía người chơi + xéo ngẫu nhiên
    let vx = (Math.random() - 0.5) * 320;
    let vy = -(280 + Math.random() * 140);   // bật lên trước

    let cx = impactX, cy = impactY;
    let rot = startRot;
    let bounceCount = 0;
    const maxBounces = 5;
    let lastTime = performance.now();

    // Bóng bắt đầu ở vị trí khung thành → nhỏ, to dần khi về phía người chơi
    const BASE_SIZE = 160;
    // Ước tính t dựa theo cy (impactY gần trên màn, floorY gần dưới)
    function estimateT(curY) {
        return Math.max(0, Math.min(1, 1 - (curY - impactY) / (floorY - impactY)));
    }

    function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.04);
        lastTime = now;

        vy += gravity * dt;
        cx += vx * dt;
        cy += vy * dt;

        // Perspective scale: bóng to dần khi nảy về phía người dùng
        const tPersp = estimateT(cy);
        applyBallPerspective(tPersp);

        // Chạm sàn → nảy
        if (cy >= floorY) {
            cy = floorY;
            vy = -Math.abs(vy) * bounceDamp;
            vx *= rollFric;
            bounceCount++;
            if (Math.abs(vy) < 30 || bounceCount >= maxBounces) {
                // Năng lượng quá nhỏ → chuyển sang lăn phẳng rồi dừng
                animateBallRollToStop(cx, cy, vx, rot, cb);
                return;
            }
        }

        // Bóng squash nhẹ khi tiếp đất (scale theo vy)
        const squash = cy >= floorY - 2 ? 'scaleY(0.75) scaleX(1.18)' : '';
        rot += vx * dt * 3.5;

        ball.style.left      = cx + 'px';
        ball.style.top       = cy + 'px';
        ball.style.bottom    = 'auto';
        ball.style.transform = `translateX(-50%) rotate(${rot}deg) ${squash}`;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ── Bóng lăn chậm dần rồi dừng (ma sát) ──
function animateBallRollToStop(startX, startY, initVx, startRot, cb) {
    let cx  = startX, cy = startY;
    let vx  = initVx;
    let rot = startRot;
    // Friction per second: tốc độ giảm dần tự nhiên
    const frictionPS = 3.2;   // giảm tuyến tính px/s mỗi giây
    let lastTime = performance.now();

    function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.04);
        lastTime = now;

        // Giảm tốc tuyến tính (giống ma sát thật)
        const sign = vx > 0 ? 1 : -1;
        vx -= sign * frictionPS * 60 * dt;
        if (sign !== (vx > 0 ? 1 : -1)) vx = 0; // không đổi chiều

        cx  += vx * dt;
        rot += vx * dt * 2.8;

        ball.style.left      = cx + 'px';
        ball.style.top       = cy + 'px';
        ball.style.bottom    = 'auto';
        ball.style.transform = `translateX(-50%) rotate(${rot}deg)`;

        if (Math.abs(vx) > 2) {
            requestAnimationFrame(tick);
        } else {
            ball.classList.remove('flying');
            cb();
        }
    }
    requestAnimationFrame(tick);
}

// ── Bóng vào lưới: nảy tưng tưng giảm dần rồi lăn chậm dừng ──
function animateBallRollInNet(impactX, impactY, startRot, cb) {
    // Bóng đã ở gần khung thành → giữ nhỏ theo phối cảnh
    const NET_SCALE  = perspectiveScale(1.0);   // tỷ lệ nhỏ nhất (gần khung thành)
    const BASE_SIZE  = 160;
    const ballSizePx = Math.round(BASE_SIZE * NET_SCALE); // ~61px

    // "Sàn lưới" ảo — bóng nảy trong vùng goal-net, không xuống sân
    // Dùng impactY + 1 lần offset nhỏ làm điểm nảy đầu
    const netFloorY  = impactY + ballSizePx * 0.6;  // nền lưới gần như ngay dưới impact

    const bounceDamp = 0.48;   // mất ~50% năng lượng mỗi lần nảy
    const rollFric   = 0.78;
    const gravity    = 1800;   // px/s² — nặng hơn để nảy nhanh ngắn

    // Vận tốc ban đầu: bóng đập vào lưới → nảy ra phía sau + lên trên nhẹ
    let vx = (Math.random() - 0.5) * 120;   // lệch ngang ngẫu nhiên
    let vy = -(160 + Math.random() * 80);    // nảy lên
    let cx = impactX, cy = impactY;
    let rot = startRot;
    let bounceCount = 0;
    const maxBounces = 6;
    let lastTime = performance.now();

    // Đặt size cố định ở tỷ lệ nhỏ (xa)
    ball.style.width  = ballSizePx + 'px';
    ball.style.height = ballSizePx + 'px';

    function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.04);
        lastTime = now;

        vy += gravity * dt;
        cx += vx * dt;
        cy += vy * dt;

        // Giữ bóng trong vùng goal-net (clamp ngang ±40px quanh impact)

        const goalNet    = document.querySelector('.goal-net');
	const gRect      = goalNet.getBoundingClientRect();
	const fieldRect  = document.getElementById('field').getBoundingClientRect();
	const netFloorY  = gRect.bottom - fieldRect.top - ballSizePx * 0.5;
	const netLeft    = gRect.left - fieldRect.left + ballSizePx * 0.5;
	const netRight   = gRect.right - fieldRect.left - ballSizePx * 0.5;
	const clampLeft  = netLeft;
	const clampRight = netRight;


        if (cx < clampLeft)  { cx = clampLeft;  vx = Math.abs(vx) * 0.55; }
        if (cx > clampRight) { cx = clampRight; vx = -Math.abs(vx) * 0.55; }

        // Chạm "sàn lưới" → nảy lên
        if (cy >= netFloorY) {
            cy = netFloorY;
            vy = -Math.abs(vy) * bounceDamp;
            vx *= rollFric;
            bounceCount++;

            if (Math.abs(vy) < 25 || bounceCount >= maxBounces) {
                // Chuyển sang lăn nhẹ rồi dừng hẳn
                // Không dùng animateBallRollToStop vì sân là phẳng dưới sân
                // Chỉ lăn nhẹ tại chỗ rồi callback
                animateBallRollToStop(cx, cy, vx * 0.4, rot, cb);
                return;
            }
        }

        // Squash nhẹ khi gần sàn
        const squash = cy >= netFloorY - 3 ? 'scaleY(0.72) scaleX(1.2)' : '';
        rot += vx * dt * 4.2;

        ball.style.left      = cx + 'px';
        ball.style.top       = cy + 'px';
        ball.style.bottom    = 'auto';
        ball.style.transform = `translateX(-50%) rotate(${rot}deg) ${squash}`;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function easeInOutQuart(t) {
    return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4)/2;
}

// ── Perspective scale: bóng lớn khi gần (dưới sân), nhỏ khi xa (gần khung thành) ──
// t=0 → bóng ở chân người dùng (gần, to),  t=1 → bóng ở khung thành (xa, nhỏ)
function perspectiveScale(t) {
    // Tuyến tính từ 1.0 → 0.38 theo chiều sâu (có thể chỉnh BIG/SMALL)
    const BIG   = 1.0;   // scale khi ở gần nhất (t=0)
    const SMALL = 0.75;  // scale khi ở xa nhất  (t=1)
    return BIG + (SMALL - BIG) * t;
}

// ── Áp dụng scale phối cảnh vào element bóng ──
function applyBallPerspective(t, extraTransform) {
    const BASE_SIZE = 160; // px — kích thước CSS gốc của .ball
    const s = perspectiveScale(t);
    const sz = Math.round(BASE_SIZE * s);
    ball.style.width  = sz + 'px';
    ball.style.height = sz + 'px';
    if (extraTransform !== undefined) {
        ball.style.transform = extraTransform;
    }
    // Cập nhật drop-shadow tương ứng kích thước
    const shadowSize = Math.round(4 + s * 8);
    ball.style.filter = `drop-shadow(0 ${shadowSize}px ${shadowSize * 2}px rgba(0,0,0,0.7))`;
}

// ════════════════════════════════════════════════════════
// KEEPER MODE — bot shoot WITH shooter run-up animation
// ════════════════════════════════════════════════════════
function keeperTurn(keeperZone) {
    if (busy) return;
    busy = true;
    setInputEnabled(false);
    actionHint.textContent = '';

    // Keeper stays standing — will dive only after the shooter actually kicks
    const botShotZone = botDecideShot();
    animateBotShotToGoal(botShotZone, keeperZone, (botScored) => {
        if (botScored) { botScore++; botHistory.push('goal'); }
        else           { botHistory.push('miss'); }
        if (!botScored) { playerScore++; playerHistory.push('goal'); }
        else            { playerHistory.push('miss'); }
        round++;
        updateScoreboard();
        setTimeout(beginRound, 900);
    });
}

function botDecideShot() {
    const total = BOT_SHOT_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < BOT_SHOT_WEIGHTS.length; i++) {
        r -= BOT_SHOT_WEIGHTS[i];
        if (r <= 0) return i;
    }
    return 8;
}

// Keeper mode: bot shooter also gets the run-up animation
function animateBotShotToGoal(botZone, keeperZone, cb) {
    const target    = BALL_ZONE_POS[botZone];
    const goalNet   = document.querySelector('.goal-net');
    const gRect     = goalNet.getBoundingClientRect();
    const fieldRect = document.getElementById('field').getBoundingClientRect();

    const bx = gRect.left - fieldRect.left + gRect.width  * (target.l / 100);
    const by = gRect.top  - fieldRect.top  + gRect.height * (1 - target.b / 100);

    // Bot run-up animation before ball launches
    runShooterAnim(() => {
        // Keeper dives exactly when the shooter's foot hits the ball
        const kTarget = ZONE_POS[keeperZone];
        keeper.style.left   = kTarget.l + '%';
        keeper.style.bottom = kTarget.b + '%';
        keeper.classList.add('diving');
        setKeeperPose(zoneToDiveDir(keeperZone));
        document.querySelector(`.zone[data-zone="${botZone}"]`).classList.add('target');

        const arcHeight = Math.max(60, (fieldRect.top + fieldRect.height - by) * 0.35);
        const sx = fieldRect.width * 0.5;
        const sy = fieldRect.height - fieldRect.height * 0.16;
        const startTime = performance.now();
        const duration  = 480;

        ball.style.transition = 'none';
        ball.classList.add('flying');

        function animFrame(now) {
            const t  = Math.min((now - startTime) / duration, 1);
            const et = easeInOutQuart(t);
            const cx = sx + (bx - sx) * et;
            const arcT = 1 - Math.pow(2*t-1, 2);
            const cy = sy + (by - sy) * et - arcHeight * arcT;
            ball.style.left   = cx + 'px';
            ball.style.top    = cy + 'px';
            ball.style.bottom = 'auto';
            applyBallPerspective(t, `translateX(-50%) rotate(${t*540}deg)`);

            if (t < 1) {
                requestAnimationFrame(animFrame);
            } else {
                setTimeout(() => {
                    const saved = isZoneSaved(botZone, keeperZone);
                    const zEl = document.querySelector(`.zone[data-zone="${botZone}"]`);
                    zEl.classList.remove('target');
                    if (saved) { zEl.classList.add('saved'); showFlash('GREAT SAVE! 🧤', 'save-flash'); animateBallRebound(bx, by, fieldRect, t*540, () => cb(false)); }
                    else { zEl.classList.add('scored'); showFlash('BOT SCORES! ⚽', 'miss-flash'); animateBallRollInNet(bx, by, t*540, () => cb(true)); }
                }, 60);
            }
        }
        requestAnimationFrame(animFrame);
    });
}

// ── HELPERS ─────────────────────────────────────────────
function isZoneSaved(shotZone, keeperZone) {
    if (shotZone === keeperZone) return true;
    const sameCol = (shotZone % 3) === (keeperZone % 3);
    const sameRow = Math.floor(shotZone / 3) === Math.floor(keeperZone / 3);
    if (sameCol || sameRow) return Math.random() < 0.38;
    return false;
}

function resetBallAndKeeper() {
    ball.style.transition = 'none';
    ball.style.left       = '50%';
    ball.style.bottom     = '16%';
    ball.style.top        = 'auto';
    ball.style.width      = '160px';
    ball.style.height     = '160px';
    ball.style.filter     = 'drop-shadow(0 4px 8px rgba(0,0,0,0.7))';
    ball.style.transform  = 'translateX(-50%)';
    ball.classList.remove('flying');

    keeper.classList.remove('diving');
    keeper.style.transition = 'none';
    keeper.style.left       = '50%';
    keeper.style.bottom     = '0%';
    keeper.style.transform  = 'translateX(-50%)';
    setKeeperPose('stand');

    shooterSprite.classList.remove('runup','kicking','impact');
    // Reset về shooter-1 (đứng yên)
    const shooterImg = shooterSprite.querySelector('img');
    if (shooterImg) shooterImg.src = shooterImg.src.replace(/shooter(-\d)?\.png/, 'shooter.png');

    requestAnimationFrame(() => {
        ball.style.transition   = 'all 0.42s cubic-bezier(.25,.46,.45,.94)';
        keeper.style.transition = 'left 0.22s cubic-bezier(.34,1.56,.64,1), bottom 0.18s ease-out';
    });
}

function clearZoneHighlights() {
    zones.forEach(z => z.classList.remove('target','saved','scored'));
}

function showFlash(msg, cls) {
    resultFlash.textContent = msg;
    resultFlash.className   = 'result-flash ' + cls;
    setTimeout(() => resultFlash.classList.add('hidden'), 950);
}

// ── END GAME ────────────────────────────────────────────
function endGame() {
    removeKeyControls();
    let trophy, title;
    if      (playerScore > botScore) { trophy = '🏆'; title = 'YOU WIN!'; }
    else if (playerScore < botScore) { trophy = '😞'; title = 'BOT WINS!'; }
    else                             { trophy = '🤝'; title = "IT'S A DRAW!"; }
    resultTrophy.textContent = trophy;
    resultTitle.textContent  = title;
    resultSub.textContent    = `${playerScore} – ${botScore}`;

    // Inject background layers if not already present
    const screenResult = document.getElementById('screenResult');
    if (!screenResult.querySelector('.result-bg')) {
        const bg = document.createElement('div');
        bg.className = 'result-bg';
        // Path relative to HTML file location
        bg.style.backgroundImage = "url('../../assets/images/penalty/ketqua.png')";
        const vignette = document.createElement('div');
        vignette.className = 'result-vignette';
        screenResult.insertBefore(vignette, screenResult.firstChild);
        screenResult.insertBefore(bg, screenResult.firstChild);
    }

    setTimeout(() => showScreen('screenResult'), 700);
}

// ── NAV ─────────────────────────────────────────────────
function rematch()  { startGame(mode); }
function goMode()   { removeKeyControls(); showScreen('screenMode'); }
function goLobby()  { window.location.href = '../../index.html'; }
