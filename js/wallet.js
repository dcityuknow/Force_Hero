// ============================================================
//  wallet.js  –  ARC Testnet USDC Ticket System
//  Chain ID : 5042002 (0x4cef52)
//  USDC     : 0x3600000000000000000000000000000000000000  (6 decimals, native-ERC20)
//  Treasury : 0x4cd1d1b157f943feb2bebf2d36770ac3346e1128
// ============================================================

const ARC_CHAIN_ID      = '0x4cef52';          // 5042002
const ARC_RPC           = 'https://rpc.testnet.arc.network';
const USDC_ADDRESS      = '0x3600000000000000000000000000000000000000';
const TREASURY_ADDRESS  = '0x4cd1d1b157f943feb2bebf2d36770ac3346e1128';
const USDC_DECIMALS     = 6;
const TICKET_KEY        = 'smicgamehub_tickets';

// Minimal ERC-20 ABI (only transfer + balanceOf)
const ERC20_ABI = [
  { "type":"function","name":"transfer",
    "inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],
    "outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable" },
  { "type":"function","name":"balanceOf",
    "inputs":[{"name":"account","type":"address"}],
    "outputs":[{"name":"","type":"uint256"}],"stateMutability":"view" }
];

// ── State ──────────────────────────────────────────────────
let walletAddress = null;

// ── Ticket helpers ─────────────────────────────────────────
function getTickets() {
  return parseInt(localStorage.getItem(TICKET_KEY) || '0', 10);
}
function setTickets(n) {
  localStorage.setItem(TICKET_KEY, Math.max(0, n).toString());
  updateTicketUI();
}
function addTickets(n)    { setTickets(getTickets() + n); }
function useTicket()      {
  if (getTickets() < 1) return false;
  setTickets(getTickets() - 1);
  return true;
}

// ── Wallet connection ──────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) {
    alert('Vui lòng cài MetaMask hoặc ví hỗ trợ ARC Testnet!');
    return null;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0];
    await switchToARC();
    updateWalletUI();
    return walletAddress;
  } catch (e) {
    console.error('Connect wallet error:', e);
    return null;
  }
}

async function switchToARC() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_CHAIN_ID }]
    });
  } catch (switchError) {
    // Chain chưa có trong ví → thêm mới
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ARC_CHAIN_ID,
          chainName: 'ARC Testnet',
          nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
          rpcUrls: [ARC_RPC],
          blockExplorerUrls: ['https://testnet.arcscan.app']
        }]
      });
    } else {
      throw switchError;
    }
  }
}

// ── Buy tickets ────────────────────────────────────────────
// Encode ERC-20 transfer(address,uint256) call data
function encodeTransfer(to, amountWei) {
  // Function selector: keccak256("transfer(address,uint256)") = 0xa9059cbb
  const selector = 'a9059cbb';
  // Pad address to 32 bytes
  const paddedAddr = to.toLowerCase().replace('0x', '').padStart(64, '0');
  // Pad amount to 32 bytes (hex)
  const paddedAmt  = BigInt(amountWei).toString(16).padStart(64, '0');
  return '0x' + selector + paddedAddr + paddedAmt;
}

async function buyTickets(quantity) {
  if (!walletAddress) {
    const addr = await connectWallet();
    if (!addr) return false;
  }

  const amountWei = BigInt(quantity) * BigInt(10 ** USDC_DECIMALS); // 1 USDC per ticket

  try {
    const data = encodeTransfer(TREASURY_ADDRESS, amountWei.toString());

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from:  walletAddress,
        to:    USDC_ADDRESS,
        data:  data,
        // gas left to wallet to estimate
      }]
    });

    showToast('⏳ Đang xử lý giao dịch…');

    // Poll for receipt
    await waitForReceipt(txHash);

    addTickets(quantity);
    showToast(`🎟️ Mua thành công ${quantity} ticket!`);
    return true;
  } catch (e) {
    if (e.code === 4001) {
      showToast('❌ Giao dịch bị huỷ.');
    } else {
      console.error('Buy ticket error:', e);
      showToast('❌ Lỗi giao dịch: ' + (e.message || 'unknown'));
    }
    return false;
  }
}

async function waitForReceipt(txHash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    try {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      });
      if (receipt && receipt.status) return receipt;
      if (receipt && receipt.status === '0x0') throw new Error('Transaction reverted');
    } catch (e) { /* keep polling */ }
  }
  throw new Error('Transaction timeout');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── UI helpers ─────────────────────────────────────────────
function updateWalletUI() {
  const el = document.getElementById('wallet-address');
  const btn = document.getElementById('wallet-btn');
  if (!el || !btn) return;
  if (walletAddress) {
    const short = walletAddress.slice(0,6) + '…' + walletAddress.slice(-4);
    el.textContent = short;
    el.style.display = 'inline';
    btn.textContent = '✅ Connected';
    btn.classList.add('connected');
  } else {
    el.style.display = 'none';
    btn.textContent = '🔗 Connect Wallet';
    btn.classList.remove('connected');
  }
}

function updateTicketUI() {
  const t = getTickets();
  document.querySelectorAll('.ticket-count').forEach(el => {
    el.textContent = t;
  });
  // Disable/enable play buttons
  document.querySelectorAll('.card-play-btn').forEach(btn => {
    if (t < 1) {
      btn.classList.add('no-ticket');
      btn.title = 'Bạn cần mua ticket để chơi';
    } else {
      btn.classList.remove('no-ticket');
      btn.title = '';
    }
  });
}

// Toast notification
function showToast(msg) {
  let toast = document.getElementById('arc-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'arc-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Modal open/close ───────────────────────────────────────
function openBuyModal() {
  if (!walletAddress) {
    connectWallet().then(addr => { if (addr) openBuyModal(); });
    return;
  }
  document.getElementById('buy-modal').classList.add('open');
}
function closeBuyModal() {
  document.getElementById('buy-modal').classList.remove('open');
}

// ── Guard for game pages ───────────────────────────────────
// Call this at the top of each game's JS/HTML
function requireTicket(lobbyPath = '../../index.html') {
  if (getTickets() < 1) {
    alert('🎟️ Bạn cần ít nhất 1 ticket để chơi!\nHãy mua ticket ở Lobby.');
    window.location.href = lobbyPath;
    return false;
  }
  useTicket();
  updateTicketUI();
  return true;
}

// ── Init ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  updateWalletUI();
  updateTicketUI();

  // Re-connect if already authorized
  if (window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length) {
        walletAddress = accounts[0];
        updateWalletUI();
      }
    });
    window.ethereum.on('accountsChanged', accounts => {
      walletAddress = accounts[0] || null;
      updateWalletUI();
    });
  }
});

// ── Expose globals ─────────────────────────────────────────
window.SmicWallet = {
  connect: connectWallet,
  buyTickets,
  getTickets,
  useTicket,
  requireTicket,
  openBuyModal,
  closeBuyModal,
  showToast
};
