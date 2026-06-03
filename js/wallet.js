'use strict';

// ── ARC TESTNET CONFIG ──────────────────────────────────
const ARC_TESTNET = {
    chainId:          '0x4CE052',
    chainName:        'Arc Testnet',
    nativeCurrency:   { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls:          ['https://rpc.testnet.arc.network'],
    blockExplorerUrls:['https://testnet.arcscan.app'],
};

const LS_KEY = 'smic_wallet_connected'; // localStorage key

// ── STATE ───────────────────────────────────────────────
let walletAddress   = null;
let walletConnected = false;

// ── DOM ─────────────────────────────────────────────────
const walletBtn     = document.getElementById('walletBtn');
const walletBtnText = document.getElementById('walletBtnText');
const walletNetwork = document.getElementById('walletNetwork');
const netDot        = document.getElementById('netDot');
const netLabel      = document.getElementById('netLabel');
const disconnectBtn = document.getElementById('disconnectBtn');

// ── HELPERS ─────────────────────────────────────────────
function shortAddr(addr) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function setWalletUI(addr, onArc) {
    walletAddress   = addr;
    walletConnected = true;

    walletBtnText.textContent = shortAddr(addr);
    walletBtn.classList.add('connected');
    walletNetwork.style.display = 'flex';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';

    if (onArc) {
        netDot.className    = 'net-dot dot-green';
        netLabel.textContent = 'ARC Testnet';
    } else {
        netDot.className    = 'net-dot dot-yellow';
        netLabel.textContent = 'Wrong Network';
    }

    // Lưu trạng thái vào localStorage để đồng bộ giữa các trang
    localStorage.setItem(LS_KEY, addr);
}

function resetWalletUI() {
    walletAddress   = null;
    walletConnected = false;

    walletBtnText.textContent = 'CONNECT WALLET';
    walletBtn.classList.remove('connected');
    walletNetwork.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'none';

    // Xoá khỏi localStorage → các trang khác sẽ biết đã disconnect
    localStorage.removeItem(LS_KEY);
}

// ── DISCONNECT ───────────────────────────────────────────
function disconnectWallet() {
    resetWalletUI();
}

// ── SWITCH / ADD ARC TESTNET ─────────────────────────────
async function switchToArc() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: ARC_TESTNET.chainId }],
        });
        return true;
    } catch (err) {
        if (err.code === 4902 || err.code === -32603) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [ARC_TESTNET],
                });
                return true;
            } catch (addErr) {
                console.error('Could not add ARC Testnet:', addErr);
                return false;
            }
        }
        console.error('Switch chain error:', err);
        return false;
    }
}

// ── CONNECT ──────────────────────────────────────────────
async function connectWallet() {
    if (walletConnected) return;

    if (!window.ethereum) {
        alert('Không tìm thấy ví EVM!\nVui lòng cài MetaMask hoặc ví tương thích EVM.');
        return;
    }

    walletBtn.disabled = true;
    walletBtnText.textContent = 'CONNECTING...';

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const switched  = await switchToArc();
        const chainId   = await window.ethereum.request({ method: 'eth_chainId' });
        const onArc     = chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();

        setWalletUI(accounts[0], onArc && switched);
    } catch (err) {
        console.error('Connect wallet error:', err);
        walletBtnText.textContent = 'CONNECT WALLET';
    } finally {
        walletBtn.disabled = false;
    }
}

// ── LẮNG NGHE THAY ĐỔI CHAIN / ACCOUNT TỪ VÍ ────────────
if (window.ethereum) {
    window.ethereum.on('chainChanged', (chainId) => {
        if (!walletAddress) return;
        const onArc = chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();
        setWalletUI(walletAddress, onArc);
    });

    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            resetWalletUI();
        } else {
            window.ethereum.request({ method: 'eth_chainId' }).then(chainId => {
                const onArc = chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();
                setWalletUI(accounts[0], onArc);
            });
        }
    });

    // Khởi động: kiểm tra localStorage trước
    const savedAddr = localStorage.getItem(LS_KEY);
    if (savedAddr) {
        // User đã connect trước đó → verify xem MetaMask vẫn còn authorize không
        window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
            if (accounts.length > 0 && accounts[0].toLowerCase() === savedAddr.toLowerCase()) {
                window.ethereum.request({ method: 'eth_chainId' }).then(chainId => {
                    const onArc = chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();
                    setWalletUI(accounts[0], onArc);
                });
            } else {
                // Không khớp hoặc MetaMask đã revoke → xoá
                localStorage.removeItem(LS_KEY);
            }
        });
    }
}

// ── ĐỒNG BỘ DISCONNECT GIỮA CÁC TAB / TRANG ─────────────
// Khi trang khác gọi localStorage.removeItem → trang này cũng reset UI
window.addEventListener('storage', (e) => {
    if (e.key !== LS_KEY) return;
    if (e.newValue === null) {
        // Đã bị disconnect từ tab/trang khác
        walletAddress   = null;
        walletConnected = false;
        walletBtnText.textContent = 'CONNECT WALLET';
        walletBtn.classList.remove('connected');
        walletNetwork.style.display = 'none';
        if (disconnectBtn) disconnectBtn.style.display = 'none';
    }
});
