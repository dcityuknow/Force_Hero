// ========================================================
// ⚙️ CẤU HÌNH THÔNG SỐ VẬT LÝ VÀ CHẾ ĐỘ CHƠI CỦA GAME
// ========================================================
const PULL_STRENGTH = 20;     // Tăng lực kéo lớn hơn vì chơi theo chuỗi phím mất thời gian nhập
const AUTO_FRICTION = 0.2;    // Lực tự trôi ngược dây về tâm giữa
const VICTORY_LIMIT = 280;    // Giới hạn khoảng cách kéo lệch để phân định thắng bại (px)

// Trạng thái chung
let ropePosition = 0;        
let gameActive = false;      
let selectedMapUrl = '';
let userTeam = 'left';        // 'left' hoặc 'right'
let botTeam = 'right';       // Ngược lại với userTeam

// Cấu hình hệ thống Audition (Mũi tên)
let currentLevel = 1;         // Level từ 1 đến 9
let arrowSequence = [];       // Mảng chứa chuỗi mũi tên hiện tại, vd: ['ArrowUp', 'ArrowLeft']
let userProgress = 0;         // Vị trí mũi tên hiện tại người chơi đang gõ đến

// Quản lý Thời Gian nhập chuỗi (Time Bar)
let timeLimit = 4000;         // Thời gian tối đa của chuỗi hiện tại (ms)
let timeRemaining = 4000;     // Thời gian còn lại (ms)
let lastTimeRef = null;       // Biến mốc thời gian phụ vụ vòng lặp đếm ngược

// Quản lý vòng lặp hành vi của BOT tự động
let botTimer = null;

// Bản đồ phím ánh xạ từ mã sự kiện Keyboard sang ký tự hiển thị trực quan
const ARROW_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
const ARROW_SYMBOLS = {
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→'
};

// Trạng thái kích hoạt chuyển động rung lắc khi giật dây
let isLeftPulling = false;
let isRightPulling = false;
let botLevel = 1; // Level hiển thị của Bot

function createTeamLevelBadges() {
    // Xóa badge cũ nếu có
    document.querySelectorAll('.team-level-badge').forEach(b => b.remove());

    const badgeLeft = document.createElement('div');
    badgeLeft.classList.add('team-level-badge');
    badgeLeft.id = 'badgeLeft';
    teamLeft.style.position = 'absolute'; // đảm bảo position
    teamLeft.appendChild(badgeLeft);

    const badgeRight = document.createElement('div');
    badgeRight.classList.add('team-level-badge');
    badgeRight.id = 'badgeRight';
    teamRight.appendChild(badgeRight);

    updateTeamLevelBadges();
}

function updateTeamLevelBadges() {
    const badgeLeft = document.getElementById('badgeLeft');
    const badgeRight = document.getElementById('badgeRight');
    if (!badgeLeft || !badgeRight) return;

    const userLabel = userTeam === 'left' ? 'YOU' : 'BOT';
    const botLabel  = botTeam  === 'left' ? 'YOU' : 'BOT';
    const userLv = currentLevel;
    const botLv  = botLevel;

    if (userTeam === 'left') {
        badgeLeft.innerText  = `YOU  LV ${userLv}`;
        badgeRight.innerText = `BOT  LV ${botLv}`;
    } else {
        badgeLeft.innerText  = `BOT  LV ${botLv}`;
        badgeRight.innerText = `YOU  LV ${userLv}`;
    }
}

// ========================================================
// 📺 TRUY VẤN CÁC PHẦN TỬ GIAO DIỆN TỪ DOM
// ========================================================
const ropeContainer = document.getElementById('ropeContainer');
const teamLeft = document.getElementById('teamLeft');
const teamRight = document.getElementById('teamRight');
const charCenter = document.getElementById('charCenter'); 
const victoryOverlay = document.getElementById('victoryOverlay');
const winnerText = document.getElementById('winnerText');

const startMenu = document.getElementById('startMenu');
const teamMenu = document.getElementById('teamMenu');
const gameBg = document.getElementById('gameBg');

const audiContainer = document.getElementById('audiContainer');
const levelIndicator = document.getElementById('levelIndicator');
const arrowChainContainer = document.getElementById('arrowChain');
const timeBarInner = document.getElementById('timeBar');

// Thiết lập hệ thống pháo hoa giấy chúc mừng (Canvas)
const canvas = document.getElementById('fireworksCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let fireworksAnimationId = null;

function resizeCanvas() {
    if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ========================================================
// 🗺️ LOGIC ĐIỀU KHIỂN CHỌN MAP -> CHỌN TEAM -> KHỞI CHẠY
// ========================================================

// Bước 1: Khi nhấn chọn Map ngoài màn hình chờ chính
function selectMap(mapUrl) {
    selectedMapUrl = mapUrl;
    if (startMenu) startMenu.classList.add('hidden');
    if (teamMenu) teamMenu.classList.remove('hidden'); // Hiện màn hình chọn Đội
}

// Bước 2: Khi nhấn chọn phe Left hoặc Phe Right
function selectTeam(side) {
    userTeam = side;
    botTeam = (side === 'left') ? 'right' : 'left';
    
    if (teamMenu) teamMenu.classList.add('hidden');
    if (gameBg) gameBg.style.backgroundImage = `url('${selectedMapUrl}')`;
    
    if (audiContainer) {
        audiContainer.classList.remove('hidden', 'side-left', 'side-right');
        audiContainer.classList.add(side === 'left' ? 'side-left' : 'side-right');
    }

    ropePosition = 0;
    currentLevel = 1;
    botLevel = 1;
    gameActive = true;
    
    // Tạo level badge trên đầu mỗi team
    createTeamLevelBadges();
    
    resizeCanvas();
    generateArrowSequence();
    startBotAI();
    
    lastTimeRef = performance.now();
    renderGame();
    updateLoop();
}

// Bấm nút quay trở lại Menu sảnh chờ chính
function backToMenu() {
    gameActive = false;
    clearTimeout(botTimer);
    
    if (startMenu) startMenu.classList.remove('hidden');
    if (teamMenu) teamMenu.classList.add('hidden');
    if (audiContainer) audiContainer.classList.add('hidden');
    
    ropePosition = 0;
    isLeftPulling = false;
    isRightPulling = false;
    
    if (charCenter) charCenter.style.opacity = '1';
    if (victoryOverlay) victoryOverlay.classList.remove('active');
    
    if (teamLeft) {
        teamLeft.style.transform = `translateX(0px)`;
        teamLeft.classList.remove('active', 'active2');
    }
    if (teamRight) {
        teamRight.style.transform = `translateX(0px)`;
        teamRight.classList.remove('active', 'active2');
    }
    
    if (canvas) canvas.style.display = 'none';
    cancelAnimationFrame(fireworksAnimationId);
    particles = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dọn dẹp item rơi và buff power-up
    cleanupItem();
    if (powerUpTimer) clearTimeout(powerUpTimer);
    powerUpActive = false;
    itemSpawnCooldown = false;
    if (timeBarInner) timeBarInner.style.background = 'linear-gradient(90deg, #4caf50, #ffeb3b, #f44336)';

    renderGame();
}

// ========================================================
// 🎵 CƠ CHẾ TẠO CHUỖI MŨI TÊN PHONG CÁCH AUDITION
// ========================================================

function generateArrowSequence() {
    arrowSequence = [];
    userProgress = 0;
    
    // Số lượng mũi tên bằng chính Level hiện tại (Tối đa là 9)
    const arrowCount = currentLevel; 
    
    for (let i = 0; i < arrowCount; i++) {
        const randomKey = ARROW_KEYS[Math.floor(Math.random() * ARROW_KEYS.length)];
        arrowSequence.push(randomKey);
    }
    
    // Thiết lập thời gian giảm dần theo cấp độ để tăng độ thử thách
    timeLimit = Math.max(1800, 5000 - (currentLevel * 350)); 
    timeRemaining = timeLimit;
    
    updateTeamLevelBadges();
    renderArrowUI();
}

// Vẽ các ô mũi tên ra màn hình giao diện
function renderArrowUI() {
    if (!arrowChainContainer) return;
    arrowChainContainer.innerHTML = '';
    
    arrowSequence.forEach((key, index) => {
        const span = document.createElement('div');
        span.classList.add('arrow-block');
        span.innerText = ARROW_SYMBOLS[key];
        
        if (index < userProgress) {
            span.classList.add('correct'); // Đã gõ chuẩn xác màu xanh lá
        }
        arrowChainContainer.appendChild(span);
    });
}

// Xử lý khi người chơi ấn sai chuỗi hoặc hết thời gian thanh cây đếm ngược
function handleSequenceFail() {
    const blocks = arrowChainContainer.querySelectorAll('.arrow-block');
    blocks.forEach(block => {
        block.classList.add('wrong'); // Chớp đỏ báo lỗi nhập chuỗi
    });
    
    userProgress = 0; // Đặt tiến trình nhập chuỗi về vị trí đầu tiên
    setTimeout(() => {
        if (gameActive) generateArrowSequence(); // Làm mới chuỗi phím khác
    }, 250);
}

// ========================================================
// ⭐ HỆ THỐNG ITEM RƠI XUỐNG (XUẤT HIỆN KHI ĐẠT LEVEL 9)
// ========================================================
let fallingItem = null;          // Object chứa trạng thái item đang rơi
let itemElement = null;          // DOM element của item
let itemAnimationId = null;      // ID của requestAnimationFrame item
let powerUpActive = false;       // Trạng thái buff: tất cả mũi tên tự xanh trong 5 giây
let powerUpTimer = null;         // Timer hết hạn buff
let itemSpawnCooldown = false;   // Ngăn spawn item liên tục

function spawnFallingItem() {
    // Nếu đã có item hoặc đang cooldown thì bỏ qua
    if (fallingItem || itemSpawnCooldown || !gameActive) return;
    itemSpawnCooldown = true;

    // Tạo DOM element cho item
    itemElement = document.createElement('div');
    itemElement.id = 'fallingItem';
    itemElement.style.cssText = `
        position: absolute;
        width: 72px;
        height: 72px;
        z-index: 60;
        cursor: pointer;
        pointer-events: auto;
        left: ${Math.random() * (window.innerWidth - 120) + 40}px;
        top: -80px;
        filter: drop-shadow(0 0 18px #ffd700) drop-shadow(0 0 36px #ffaa00) drop-shadow(0 0 8px #fff8dc);
        animation: glowPulse 0.7s ease-in-out infinite alternate;
    `;

    const img = document.createElement('img');
    img.src = '../../assets/images/tugofwar/item.png';
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
    itemElement.appendChild(img);

    // Gắn vào game-container
    document.querySelector('.game-container').appendChild(itemElement);

    fallingItem = {
        el: itemElement,
        y: -80,
        speed: 1.2,  // rơi chậm
        missed: false
    };

    // Click để nhận buff
    itemElement.addEventListener('click', collectItem);

    animateFallingItem();
}

function animateFallingItem() {
    if (!fallingItem || !gameActive) {
        cleanupItem();
        return;
    }

    fallingItem.y += fallingItem.speed;
    fallingItem.el.style.top = fallingItem.y + 'px';

    // Item rơi qua đáy màn hình -> mất cơ hội
    if (fallingItem.y > window.innerHeight + 20) {
        cleanupItem();
        // Cho phép spawn lại sau 15 giây
        setTimeout(() => { itemSpawnCooldown = false; }, 15000);
        return;
    }

    itemAnimationId = requestAnimationFrame(animateFallingItem);
}

function collectItem() {
    if (!fallingItem || powerUpActive) return;
    cleanupItem();

    powerUpActive = true;

    // Hiển thị thông báo buff
    showPowerUpNotice();

    // Tự động xanh hết tất cả mũi tên và không cần nhập
    activatePowerUp();

    // Sau 5 giây tắt buff
    powerUpTimer = setTimeout(() => {
        powerUpActive = false;
        itemSpawnCooldown = false;
        generateArrowSequence(); // Trả về chế độ bình thường
    }, 5000);
}

function activatePowerUp() {
    // Đặt userProgress = hết chuỗi = tất cả mũi tên xanh
    userProgress = arrowSequence.length;
    renderArrowUI();

    // Bắt đầu đếm ngược hiển thị thời gian buff trên thanh time bar (màu vàng)
    if (timeBarInner) {
        timeBarInner.style.background = 'linear-gradient(90deg, #ffd700, #ffaa00)';
        timeBarInner.style.width = '100%';
    }

    // Cập nhật liên tục trong 5 giây
    let remaining = 5000;
    const buffInterval = setInterval(() => {
        if (!powerUpActive) {
            clearInterval(buffInterval);
            if (timeBarInner) {
                timeBarInner.style.background = 'linear-gradient(90deg, #4caf50, #ffeb3b, #f44336)';
            }
            return;
        }
        remaining -= 100;
        const pct = Math.max(0, (remaining / 5000) * 100);
        if (timeBarInner) timeBarInner.style.width = pct + '%';
        // Giữ tất cả mũi tên xanh liên tục
        userProgress = arrowSequence.length;
        renderArrowUI();
    }, 100);
}

function showPowerUpNotice() {
    const notice = document.createElement('div');
    notice.id = 'powerUpNotice';
    notice.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        color: #fff;
        font-size: 1.6rem;
        font-weight: 900;
        padding: 18px 40px;
        border-radius: 16px;
        z-index: 200;
        text-align: center;
        text-shadow: -2px -2px 0 #7a4100, 2px 2px 0 #7a4100;
        box-shadow: 0 0 40px #ffd700, 0 0 80px #ff8c00;
        animation: popUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
    `;
    notice.innerHTML = '⭐ POWER UP! ⭐<br><span style="font-size:1rem;font-weight:700;">Chỉ cần bấm SPACE trong 5 giây!</span>';
    document.querySelector('.game-container').appendChild(notice);
    setTimeout(() => notice.remove(), 2500);
}

function cleanupItem() {
    if (itemAnimationId) {
        cancelAnimationFrame(itemAnimationId);
        itemAnimationId = null;
    }
    if (itemElement && itemElement.parentNode) {
        itemElement.removeEventListener('click', collectItem);
        itemElement.parentNode.removeChild(itemElement);
    }
    fallingItem = null;
    itemElement = null;
}

// ========================================================
// 🤖 TRÍ TUỆ NHÂN TẠO CỦA BOT TỰ ĐỘNG
// ========================================================
function startBotAI() {
    if (!gameActive) return;
    
    // Tốc độ và tần suất giật dây của Bot phụ thuộc vào Level hiện tại của người chơi
    // Càng lên Level cao Bot kéo càng nhanh và tần suất dồn dập hơn
    let botDelay = Math.max(400, 1600 - (currentLevel * 120)); 
    // Thêm một chút yếu tố ngẫu nhiên để Bot giật dây tự nhiên giống người thật hơn
    botDelay += (Math.random() - 0.5) * 200; 
    
    botTimer = setTimeout(() => {
        if (gameActive) {
            executePull(botTeam);
            botLevel = botLevel >= 9 ? 9 : botLevel + 1;
            updateTeamLevelBadges();
            startBotAI();
        }
    }, botDelay);
}

// ========================================================
// 🎮 VẬN HÀNH LOGIC DI CHUYỂN DÂY VÀ ĐỒNG BỘ HIỆU ỨNG
// ========================================================

function executePull(team) {
    if (!gameActive) return;

    if (team === 'left') {
        ropePosition -= PULL_STRENGTH;
        isLeftPulling = true;
        teamLeft.classList.add('active');
        teamLeft.classList.remove('active2'); 
        
        setTimeout(() => {
            isLeftPulling = false;
            if (teamLeft) teamLeft.classList.remove('active');
        }, 250); 
    } else {
        ropePosition += PULL_STRENGTH;
        isRightPulling = true;
        teamRight.classList.add('active');
        teamRight.classList.remove('active2'); 
        
        setTimeout(() => {
            isRightPulling = false;
            if (teamRight) teamRight.classList.remove('active');
        }, 250);
    }
    checkGameOver();
}

function renderGame() {
    if (ropePosition < -VICTORY_LIMIT) ropePosition = -VICTORY_LIMIT;
    if (ropePosition > VICTORY_LIMIT) ropePosition = VICTORY_LIMIT;

    if (ropeContainer) ropeContainer.style.left = `calc(50% + ${ropePosition}px)`;
    if (teamLeft) teamLeft.style.transform = `translateX(${ropePosition}px)`;
    if (teamRight) teamRight.style.transform = `translateX(${ropePosition}px)`;

    // Xử lý hoạt ảnh gồng mình hoảng loạn khi đội bị kéo lôi lệch về tâm đối thủ
    if (ropePosition < -10) { 
        if (!isLeftPulling && teamLeft) teamLeft.classList.remove('active');
        if (teamLeft) teamLeft.classList.remove('active2'); 

        if (!isRightPulling && teamRight) {
            teamRight.classList.add('active2');
            teamRight.classList.remove('active');
        }
    } 
    else if (ropePosition > 10) { 
        if (!isRightPulling && teamRight) teamRight.classList.remove('active');
        if (teamRight) teamRight.classList.remove('active2'); 

        if (!isLeftPulling && teamLeft) {
            teamLeft.classList.add('active2');
            teamLeft.classList.remove('active');
        }
    } 
    else {
        if (!isLeftPulling && teamLeft) teamLeft.classList.remove('active', 'active2');
        if (!isRightPulling && teamRight) teamRight.classList.remove('active', 'active2');
    }
}

function checkGameOver() {
    if (Math.abs(ropePosition) >= VICTORY_LIMIT) {
        gameActive = false;
        clearTimeout(botTimer);
        
        if (charCenter) charCenter.style.opacity = '0';

        if (ropePosition < 0) {
            winnerText.innerText = "🎉 LEFT TEAM WIN!";
            winnerText.style.color = "#d50000";
        } else {
            winnerText.innerText = "🎉 RIGHT TEAM WIN!";
            winnerText.style.color = "#2962ff";
        }
        
        victoryOverlay.classList.add('active');
        canvas.style.display = 'block';
        startFireworks();
    }
}

function resetGame() {
    ropePosition = 0;
    currentLevel = 1;
    botLevel = 1;
    gameActive = true;
    isLeftPulling = false;
    isRightPulling = false;
    
    if (charCenter) charCenter.style.opacity = '1';
    victoryOverlay.classList.remove('active');
    
    if (teamLeft) {
        teamLeft.style.transform = `translateX(0px)`;
        teamLeft.classList.remove('active', 'active2');
    }
    if (teamRight) {
        teamRight.style.transform = `translateX(0px)`;
        teamRight.classList.remove('active', 'active2');
    }
    
    canvas.style.display = 'none';
    cancelAnimationFrame(fireworksAnimationId);
    particles = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dọn dẹp item rơi và buff power-up
    cleanupItem();
    if (powerUpTimer) clearTimeout(powerUpTimer);
    powerUpActive = false;
    itemSpawnCooldown = false;
    if (timeBarInner) timeBarInner.style.background = 'linear-gradient(90deg, #4caf50, #ffeb3b, #f44336)';

    generateArrowSequence();
    updateTeamLevelBadges();
    startBotAI();
    
    lastTimeRef = performance.now();
    renderGame();
    updateLoop();
}

// ========================================================
// ⌨️ BẮT SỰ KIỆN BAN PHÍM QUY TRÌNH AUDITION CHÍNH XÁC
// ========================================================
window.addEventListener('keydown', (event) => {
    if (!gameActive) return;
    
    const key = event.key.toLowerCase();
    
    // Nếu đang buff power-up: bỏ qua phím mũi tên, chỉ xử lý SPACE
    if (powerUpActive && ARROW_KEYS.includes(key)) {
        event.preventDefault();
        return;
    }

    // Kiểm tra xem phím nhấn có nằm trong danh mục 4 phím mũi tên điều hướng không
    if (ARROW_KEYS.includes(key)) {
        event.preventDefault(); // Ngăn hành vi cuộn mặc định của trang web
        
        // Kiểm tra xem có trùng khớp với phím tiếp theo trong chuỗi mục tiêu không
        if (key === arrowSequence[userProgress]) {
            userProgress++;
            renderArrowUI(); // Cập nhật chuyển ô mũi tên sang màu xanh lá cây
        } else {
            // Nếu bấm sai bất cứ một nút nào, phạt mất chuỗi, làm lại từ đầu
            handleSequenceFail();
        }
    } 
    // Khớp lệnh bấm nút kết thúc SPACE để nhận lực giật kéo giống Audition
    else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        
        // Chỉ khi người chơi hoàn thành chính xác 100% tất cả chuỗi mới được giật kéo
        if (userProgress === arrowSequence.length) {
            executePull(userTeam); // Thực hiện kéo dây cho phe người chơi

            // Nếu đang có buff power-up -> giữ nguyên, làm mới chuỗi xanh hết
            if (powerUpActive) {
                generateArrowSequence();
                userProgress = arrowSequence.length;
                renderArrowUI();
                return;
            }
            
            // Tiến lên cấp độ tiếp theo để tăng độ khó chuỗi (vòng lặp từ 1 đến 9)
            const prevLevel = currentLevel;
            currentLevel = currentLevel >= 9 ? 9 : currentLevel + 1;

            // Khi đạt level 9 lần đầu → spawn item rơi xuống
            if (prevLevel < 9 && currentLevel === 9 && !itemSpawnCooldown) {
                setTimeout(spawnFallingItem, 600);
            }

            generateArrowSequence(); // Chuyển chuỗi mới
        } else {
            handleSequenceFail();
        }
    }
});

// Hàm hỗ trợ click ảo (nếu có dùng nút bấm phụ trợ trên giao diện)
function handleVirtualPull(team) {
    if (!gameActive) return;
    if (team === userTeam) {
        // Chế độ chơi bắt buộc dùng Audition, không cho click trực tiếp ăn gian lực
        return;
    }
}

// Vòng lặp tính toán thời gian co rút của thanh tiến trình (Time Bar) và ma sát trôi ngược
function updateLoop(now) {
    if (!gameActive) return;
    
    if (!now) now = performance.now();
    const deltaTime = now - (lastTimeRef || now);
    lastTimeRef = now;

    // Giảm thời gian đếm ngược của chuỗi phím Audition hiện hành
    timeRemaining -= deltaTime;
    if (timeRemaining <= 0) {
        timeRemaining = 0;
        handleSequenceFail(); // Hết thời gian mà chưa bấm kết thúc -> Thất bại chuỗi
    }
    
    // Cập nhật tỷ lệ % thanh Bar hiển thị thu hẹp dần trên HTML
    const timePercentage = Math.max(0, (timeRemaining / timeLimit) * 100);
    if (timeBarInner) {
        timeBarInner.style.width = `${timePercentage}%`;
    }

    // Lực ma sát vật lý kéo co tự trôi chậm về vị trí cân bằng giữa sân đấu
    if (ropePosition > 0) {
        ropePosition -= AUTO_FRICTION;
        if (ropePosition < 0) ropePosition = 0;
    } else if (ropePosition < 0) {
        ropePosition += AUTO_FRICTION;
        if (ropePosition > 0) ropePosition = 0;
    }

    renderGame();
    requestAnimationFrame(updateLoop);
}

// ========================================================
// 🎉 HỆ THỐNG XỬ LÝ PHÁO HOA GIẤY CHÚC MỪNG (CONFETTI)
// ========================================================
function random(min, max) {
    return Math.random() * (max - min) + min;
}

const CONFETTI_COLORS = [
    '#ff0a43', '#ffdd00', '#22ff00', '#00e1ff', 
    '#ff00b7', '#ff6a00', '#b700ff', '#003cff'
];

class ConfettiParticle {
    constructor() {
        this.x = random(0, canvas.width);
        this.y = canvas.height + random(10, 100);
        this.width = random(14, 26);
        this.height = random(8, 16);
        this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        this.speedX = random(-5, 5);
        this.speedY = random(-16, -23); 
        this.gravity = 0.24;   
        this.friction = 0.98;  
        this.rotation = random(0, 360);
        this.rotationSpeed = random(-5, 5);
    }

    update() {
        this.speedX *= this.friction;
        this.speedY += this.gravity; 
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        if (this.y > canvas.height + 50 && this.speedY > 0) {
            return false;
        }
        return true;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
}

function startFireworks() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!gameActive && particles.length < 180) { 
        for (let i = 0; i < 6; i++) {
            particles.push(new ConfettiParticle());
        }
    }
    particles = particles.filter(p => {
        let alive = p.update();
        if (alive) p.draw();
        return alive;
    });
    fireworksAnimationId = requestAnimationFrame(startFireworks);
}