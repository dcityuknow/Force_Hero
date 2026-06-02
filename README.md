# SMIC GAME HUB – Hướng dẫn cài đặt

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

---

## 🚀 Cách chạy

Chỉ cần mở `index.html` trong trình duyệt.  
Hoặc dùng Live Server (VS Code) trỏ vào thư mục gốc.

---

## 📦 Di chuyển ảnh cũ sang cấu trúc mới

Ảnh cũ nằm ở `assets/images/` → **di chuyển vào subfolder** tương ứng:

| Ảnh cũ                            | Vị trí mới                              |
|-----------------------------------|-----------------------------------------|
| `assets/images/background0.png`   | Giữ nguyên (dùng chung)                 |
| `assets/images/background1.png`   | `assets/images/tugofwar/background1.png`|
| `assets/images/background2.png`   | `assets/images/tugofwar/background2.png`|
| `assets/images/background3.png`   | `assets/images/tugofwar/background3.png`|
| `assets/images/team_left*.png`    | `assets/images/tugofwar/team_left*.png` |
| `assets/images/team_right*.png`   | `assets/images/tugofwar/team_right*.png`|
| `assets/images/character_center.png` | `assets/images/tugofwar/`            |
| `assets/images/rope.png`          | `assets/images/tugofwar/rope.png`       |
| `assets/images/flag.png`          | `assets/images/tugofwar/flag.png`       |
| `assets/images/dust.png`          | `assets/images/tugofwar/dust.png`       |
| `assets/images/ketqua.png`        | `assets/images/tugofwar/ketqua.png`     |
| `assets/images/item.png`          | `assets/images/tugofwar/item.png`       |

---

## ➕ Thêm game mới

1. Tạo folder `games/tengame/`
2. Thêm `tengame.html`, `css/tengame.css`, `js/tengame.js`
3. Thêm ảnh riêng vào `assets/images/tengame/`
4. Thêm card vào `index.html` (copy 1 card có sẵn, đổi màu + text)
