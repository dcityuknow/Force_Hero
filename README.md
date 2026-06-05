**CONTRACT**
```
0x043e7BBF1B2a1E94aD7a24bC5B8a80d110Ec85AB
```

# 🎮 Force Hero 

**Nền tảng game Web3 trên Arc Testnet** – Kết hợp giải trí và blockchain.


## ✨ Giới thiệu

Force Hero là **Game Hub** đa thể loại, cho phép người chơi:
- Kết nối ví Arc Testnet
- Mua Ticket bằng USDC để chơi game
- Tham gia các mini-game (Kéo co, Penalty, ...)
- Sắp tới: Bảng xếp hạng on-chain, NFT Reward, Tournament

**Live Demo**: [force-hero-bice.vercel.app](https://force-hero-bice.vercel.app)

---

## 📁 Cấu trúc thư mục dự án (Phiên bản hiện tại)

## 📁 Cấu trúc thư mục

```
/  (thư mục gốc dự án)
│
├── index.html                        ← Trang lobby chung (mở file này để vào game)
├── css/
│   └── style.css                     ← CSS của lobby
├── js/
│   └── main.js                       ← Logic lobby (tạo sao, fade transition)
│
├── games/
│   ├── tugofwar/
│   │   ├── tugofwar.html             ← HTML game kéo co
│   │   ├── css/tug.css               ← CSS game kéo co
│   │   └── js/tug.js                 ← Logic game kéo co (đã cập nhật path)
│   │
│   └── penalty/
│       ├── penalty.html              ← HTML game penalty
│       ├── css/penalty.css           ← CSS game penalty
│       └── js/penalty.js             ← Logic game penalty
│
└── assets/
    ├── images/
    │   ├── background0.png           ← Ảnh dùng CHUNG (background lobby/menu chờ)
    │   │
    │   ├── tugofwar/                 ← Ảnh riêng của game kéo co
    │   │   ├── background1.png
    │   │   ├── background2.png
    │   │   ├── background3.png
    │   │   ├── team_left.png
    │   │   ├── team_left_active.png
    │   │   ├── team_left_active2.png
    │   │   ├── team_right.png
    │   │   ├── team_right_active.png
    │   │   ├── team_right_active2.png
    │   │   ├── character_center.png
    │   │   ├── rope.png
    │   │   ├── flag.png
    │   │   ├── dust.png
    │   │   ├── ketqua.png
    │   │   └── item.png
    │   │
    │   └── penalty/                  ← Ảnh riêng của game penalty (tuỳ chọn)
    │       └── (thêm ảnh nếu cần)
    │
    └── sounds/
        ├── tugofwar/                 ← Âm thanh kéo co
        └── penalty/                  ← Âm thanh penalty
```

**1. cài đặt biến môi trường**
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

```
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

```
nvm install 22
nvm use 22
nvm alias default 22
```

```
node -v    # → v22.xx.x
npm -v     # → 10.xx.x
```

**2. Cài đặt game**
```
git clone https://github.com/dcityuknow/Force_Hero.git
```

```
npm init -y
npm install express ethers dotenv cors
```

```
nano .env
```







