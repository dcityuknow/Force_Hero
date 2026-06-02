'use strict';

// ── ARC TESTNET CONFIG ──────────────────────────────────
const ARC_TESTNET = {
    chainId:         '0x4CE052',          // 5042002 in hex
    chainName:       'Arc Testnet',
    nativeCurrency:  { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls:         ['https://rpc.testnet.arc.network'],
    blockExplorerUrls: ['https://testnet.arcscan.app'],
};

// ── STATE ───────────────────────────────────────────────
let walletAddress = null;
let walletConnected = false;

// ── DOM ─────────────────────────────────────────────────
const walletBtn     = document.getElementById('walletBtn');
const walletBtnText = document.getElementById('walletBtnText');
const walletNetwork = document.getElementById('walletNetwork');
const netDot        = document.getElementById('netDot');
const netLabel      = document.getElementById('netLabel');

// ── HELPERS ─────────────────────────────────────────────
function shortAddr(addr) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function setWalletUI(addr, onArc) {
    walletBtnText.textContent = shortAddr(addr);
    walletBtn.classList.add('connected');
    walletNetwork.style.display = 'flex';
    if (onArc) {
        netDot.className = 'net-dot dot-green';
        netLabel.textContent = 'ARC Testnet';
    } else {
        netDot.className = 'net-dot dot-yellow';
        netLabel.textContent = 'Wrong Network';
    }
}

function resetWalletUI() {
    walletBtnText.textContent = 'CONNECT WALLET';
    walletBtn.classList.remove('connected');
    walletNetwork.style.display = 'none';
    walletAddress = null;
    walletConnected = false;
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
        // Chain not added yet → add it
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
    // Already connected → do nothing (or could disconnect)
    if (walletConnected) return;

    if (!window.ethereum) {
        alert('Không tìm thấy ví EVM!\nVui lòng cài MetaMask hoặc ví tương thích EVM.');
        return;
    }

    walletBtn.disabled = true;
    walletBtnText.textContent = 'CONNECTING...';

    try {
        // 1. Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        walletAddress = accounts[0];
        walletConnected = true;

        // 2. Auto-switch to ARC Testnet
        const switched = await switchToArc();

        // 3. Check current chain
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const onArc = chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();

        setWalletUI(walletAddress, onArc && switched);

    } catch (err) {
        console.error('Connect wallet error:', err);
        walletBtnText.textContent = 'CONNECT WALLET';
    } finally {
        walletBtn.disabled = false;
    }
}

// ── LISTEN FOR CHAIN / ACCOUNT CHANGES ──────────────────
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
            walletAddress = accounts[0];
            window.ethereum.request({ method: 'eth_chainId' }).then(chainId => {
                const onArc = chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();
                setWalletUI(walletAddress, onArc);
            });
        }
    });

    // Auto-reconnect if user already authorized
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
        if (accounts.length > 0) {
            walletAddress = accounts[0];
            walletConnected = true;
            window.ethereum.request({ method: 'eth_chainId' }).then(chainId => {
                const onArc = chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();
                setWalletUI(walletAddress, onArc);
            });
        }
    });
}
