// ============================================================
//  wallet.js  –  ARC Testnet USDC Ticket System (On-Chain)
//  Chain ID    : 5042002 (0x4cef52)
//  USDC        : 0x3600000000000000000000000000000000000000  (6 decimals)
//  Treasury    : 0x4cd1d1b157f943feb2bebf2d36770ac3346e1128
//  TicketSystem: 0x74708fd724d84C614383ffA494FFBfbFC176e507
// ============================================================

const ARC_CHAIN_ID         = '0x4cef52';
const ARC_RPC              = 'https://rpc.testnet.arc.network';
const USDC_ADDRESS         = '0x3600000000000000000000000000000000000000';
const TREASURY_ADDRESS     = '0x4cd1d1b157f943feb2bebf2d36770ac3346e1128';
const TICKET_CONTRACT_ADDR = '0x74708fd724d84C614383ffA494FFBfbFC176e507';
const USDC_DECIMALS        = 6;

// ── ABI encoders ───────────────────────────────────────────

function encodeApprove(spender, amountWei) {
  const selector = '095ea7b3';
  
  // Đảm bảo địa chỉ chỉ có 40 ký tự hex bằng cách xóa 0x và chuyển chữ thường
  const cleanAddr = spender.toLowerCase().replace(/^0x/, '');
  if (cleanAddr.length !== 42 && cleanAddr.length !== 40) {
     console.error("Địa chỉ spender không hợp lệ!");
  }
  
  const paddedAddr = cleanAddr.padStart(64, '0');
  const paddedAmt  = BigInt(amountWei).toString(16).padStart(64, '0');
  
  return '0x' + selector + paddedAddr + paddedAmt;
}

function encodeBuyTickets(quantity) {
  const selector = '27a29b4b';
  const paddedQty = BigInt(quantity).toString(16).padStart(64, '0');
  return '0x' + selector + paddedQty;
}

function encodeUseTickets(quantity) {
  const selector = '8f3b9b1c';
  const paddedQty = BigInt(quantity).toString(16).padStart(64, '0');
  return '0x' + selector + paddedQty;
}

function encodeUserTickets(account) {
  const selector   = '83a26201';
  const paddedAddr = account.toLowerCase().replace('0x', '').padStart(64, '0');
  return '0x' + selector + paddedAddr;
}

// ── State ──────────────────────────────────────────────────
let walletAddress    = null;
let activeProvider   = null;   // the EIP-1193 provider currently in use

// ── Provider detection (supports multi-wallet environments) ──

/**
 * Collect all EVM-compatible providers available in the page.
 * Handles: single window.ethereum, window.ethereum.providers array,
 * and per-wallet globals (window.phantom.ethereum, window.coinbaseWalletExtension, etc.)
 */
function detectProviders() {
  const seen = new Set();
  const list = [];

  function add(provider, label) {
    if (!provider || seen.has(provider)) return;
    seen.add(provider);
    list.push({ provider, label });
  }

  // Standard: window.ethereum may already be an array proxy
  if (window.ethereum) {
    const providers = window.ethereum.providers;
    if (Array.isArray(providers) && providers.length > 0) {
      providers.forEach(p => {
        const name = guessWalletName(p);
        add(p, name);
      });
    } else {
      add(window.ethereum, guessWalletName(window.ethereum));
    }
  }

  // Phantom exposes its own Ethereum provider separately
  if (window.phantom?.ethereum) add(window.phantom.ethereum, 'Phantom');

  // Coinbase Wallet SDK
  if (window.coinbaseWalletExtension) add(window.coinbaseWalletExtension, 'Coinbase Wallet');

  // Brave Wallet
  if (window.ethereum?.isBraveWallet) add(window.ethereum, 'Brave Wallet');

  // Trust Wallet
  if (window.trustwallet) add(window.trustwallet, 'Trust Wallet');

  // OKX Wallet
  if (window.okxwallet) add(window.okxwallet, 'OKX Wallet');

  // Bitget Wallet
  if (window.bitkeep?.ethereum) add(window.bitkeep.ethereum, 'Bitget Wallet');

  // Rabby
  if (window.rabby) add(window.rabby, 'Rabby');

  return list;
}

function guessWalletName(p) {
  if (!p) return 'Unknown Wallet';
  if (p.isPhantom)          return 'Phantom';
  if (p.isMetaMask)         return 'MetaMask';
  if (p.isCoinbaseWallet)   return 'Coinbase Wallet';
  if (p.isBraveWallet)      return 'Brave Wallet';
  if (p.isTrust)            return 'Trust Wallet';
  if (p.isOKExWallet || p.isOkxWallet) return 'OKX Wallet';
  if (p.isBitKeep)          return 'Bitget Wallet';
  if (p.isRabby)            return 'Rabby';
  if (p.isTokenPocket)      return 'TokenPocket';
  if (p.isImToken)          return 'imToken';
  return 'EVM Wallet';
}

// ── Wallet picker modal ────────────────────────────────────

function createWalletPickerModal() {
  if (document.getElementById('wallet-picker-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'wallet-picker-modal';
  overlay.innerHTML = `
    <div id="wallet-picker-box">
      <div id="wallet-picker-header">
        <span>Chọn ví của bạn</span>
        <button id="wallet-picker-close" onclick="closeWalletPicker()">✕</button>
      </div>
      <div id="wallet-picker-list"></div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeWalletPicker(); });

  // Inline styles so the modal works without extra CSS file
  const style = document.createElement('style');
  style.textContent = `
    #wallet-picker-modal {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,.55); z-index: 99999;
      align-items: center; justify-content: center;
    }
    #wallet-picker-modal.open { display: flex; }
    #wallet-picker-box {
      background: #1a1a2e; border: 1px solid #444; border-radius: 16px;
      padding: 24px; min-width: 320px; max-width: 90vw;
      box-shadow: 0 8px 40px rgba(0,0,0,.6);
    }
    #wallet-picker-header {
      display: flex; justify-content: space-between; align-items: center;
      color: #fff; font-size: 18px; font-weight: 700; margin-bottom: 16px;
    }
    #wallet-picker-close {
      background: none; border: none; color: #aaa; font-size: 20px;
      cursor: pointer; line-height: 1;
    }
    #wallet-picker-list { display: flex; flex-direction: column; gap: 10px; }
    .wallet-picker-item {
      display: flex; align-items: center; gap: 12px;
      background: #252547; border: 1px solid #555; border-radius: 12px;
      padding: 12px 16px; cursor: pointer; color: #fff;
      font-size: 15px; font-weight: 500; transition: background .15s;
    }
    .wallet-picker-item:hover { background: #2e2e60; border-color: #7c6af7; }
    .wallet-picker-item span.wpi-icon { font-size: 24px; }
    #wallet-picker-no-wallet {
      color: #bbb; text-align: center; font-size: 14px; padding: 8px 0;
    }
    #wallet-picker-no-wallet a { color: #7c6af7; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);
}

function walletIcon(name) {
  const map = {
    'MetaMask':       '🦊',
    'Phantom':        '👻',
    'Coinbase Wallet':'🔵',
    'Brave Wallet':   '🦁',
    'Trust Wallet':   '🛡️',
    'OKX Wallet':     '⭕',
    'Bitget Wallet':  '💎',
    'Rabby':          '🐇',
    'TokenPocket':    '📱',
    'imToken':        '🔑',
    'EVM Wallet':     '💼',
  };
  return map[name] || '💼';
}

function openWalletPicker() {
  createWalletPickerModal();
  const modal = document.getElementById('wallet-picker-modal');
  const list  = document.getElementById('wallet-picker-list');
  list.innerHTML = '';

  const providers = detectProviders();

  if (providers.length === 0) {
    list.innerHTML = `<div id="wallet-picker-no-wallet">
      Không tìm thấy ví EVM nào.<br>
      <a href="https://metamask.io" target="_blank">Cài MetaMask</a> hoặc ví EVM khác.
    </div>`;
  } else {
    providers.forEach(({ provider, label }) => {
      const item = document.createElement('div');
      item.className = 'wallet-picker-item';
      item.innerHTML = `<span class="wpi-icon">${walletIcon(label)}</span><span>${label}</span>`;
      item.addEventListener('click', () => {
        closeWalletPicker();
        connectWithProvider(provider);
      });
      list.appendChild(item);
    });
  }

  modal.classList.add('open');
}

function closeWalletPicker() {
  const modal = document.getElementById('wallet-picker-modal');
  if (modal) modal.classList.remove('open');
}

// ── Wallet connection ──────────────────────────────────────

/**
 * Connect wallet:
 * - If multiple providers detected → show picker modal
 * - If exactly one provider → connect directly
 * - If none → prompt install
 */
async function connectWallet() {
  const providers = detectProviders();

  if (providers.length === 0) {
    alert('Không tìm thấy ví EVM nào.\nVui lòng cài MetaMask hoặc ví EVM khác!');
    return null;
  }

  if (providers.length === 1) {
    return connectWithProvider(providers[0].provider);
  }

  // Multiple wallets → show picker
  openWalletPicker();
  return null; // connectWithProvider will be called from picker
}

async function connectWithProvider(provider) {
  try {
    activeProvider = provider;
    // Make the chosen provider the global one for subsequent calls
    window.ethereum = provider;

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0];

    // Always switch to ARC network immediately after connecting
    await switchToARC();

    updateWalletUI();
    await refreshTickets();
    attachProviderEvents(provider);
    return walletAddress;
  } catch (e) {
    console.error('Connect wallet error:', e);
    if (e.code !== 4001) showToast('❌ Lỗi kết nối ví: ' + (e.message || 'unknown'));
    return null;
  }
}

function attachProviderEvents(provider) {
  // Remove old listeners if any (best-effort)
  try { provider.removeAllListeners?.('accountsChanged'); } catch (_) {}
  try { provider.removeAllListeners?.('chainChanged'); } catch (_) {}

  provider.on('accountsChanged', async accounts => {
    walletAddress = accounts[0] || null;
    updateWalletUI();
    if (walletAddress) {
      await refreshTickets();
    } else {
      updateTicketUI(0);
    }
  });

  provider.on('chainChanged', () => window.location.reload());
}

// ── Disconnect wallet ──────────────────────────────────────

function disconnectWallet() {
  walletAddress  = null;
  activeProvider = null;
  updateWalletUI();
  updateTicketUI(0);
  showToast('🔌 Đã ngắt kết nối ví.');
}

// ── Switch network ─────────────────────────────────────────

async function switchToARC() {
  const provider = activeProvider || window.ethereum;
  if (!provider) return;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_CHAIN_ID }]
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ARC_CHAIN_ID,
          chainName: 'ARC Testnet',
          nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
          rpcUrls: [ARC_RPC],
          blockExplorerUrls: ['https://testnet.arcscan.app']
        }]
      });
    } else {
      throw switchError;
    }
  }
}

// ── On-chain ticket reads ──────────────────────────────────

async function getTicketsOnChain(address) {
  const addr = address || walletAddress;
  if (!addr) return 0;
  const provider = activeProvider || window.ethereum;
  if (!provider) return 0;
  try {
    const result = await provider.request({
      method: 'eth_call',
      params: [{ to: TICKET_CONTRACT_ADDR, data: encodeUserTickets(addr) }, 'latest']
    });
    return Number(BigInt(result));
  } catch (e) {
    console.error('getTicketsOnChain error:', e);
    return 0;
  }
}

async function refreshTickets() {
  const count = await getTicketsOnChain();
  updateTicketUI(count);
  return count;
}

// ── Buy tickets (approve → buyTickets) ────────────────────

async function buyTickets(quantity) {
  if (!walletAddress) {
    const addr = await connectWallet();
    if (!addr) return false;
  }

  const provider  = activeProvider || window.ethereum;
  const totalCost = BigInt(quantity) * BigInt(10 ** USDC_DECIMALS);

  try {
    showToast('🔐 Bước 1/2: Phê duyệt USDC…');
    const approveTx = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to:   USDC_ADDRESS,
        data: encodeApprove(TICKET_CONTRACT_ADDR, totalCost.toString()),
      }]
    });

    showToast('⏳ Đang chờ xác nhận approve…');
    await waitForReceipt(approveTx);
    showToast('✅ Approve thành công!');

    showToast('🎟️ Bước 2/2: Mua vé on-chain…');
    const buyTx = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to:   TICKET_CONTRACT_ADDR,
        data: encodeBuyTickets(quantity),
      }]
    });

    showToast('⏳ Đang chờ xác nhận mua vé…');
    await waitForReceipt(buyTx);

    await refreshTickets();
    showToast(`🎟️ Mua thành công ${quantity} ticket!`);
    return true;

  } catch (e) {
    if (e.code === 4001) {
      showToast('❌ Giao dịch bị huỷ.');
    } else {
      console.error('Buy ticket error:', e);
      showToast('❌ Lỗi: ' + (e.message || 'unknown'));
    }
    return false;
  }
}

// ── Use ticket (on-chain deduction) ───────────────────────

async function useTicket() {
  if (!walletAddress) return false;

  const provider = activeProvider || window.ethereum;
  const current  = await getTicketsOnChain();
  if (current < 1) return false;

  try {
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to:   TICKET_CONTRACT_ADDR,
        data: encodeUseTickets(1),
        gas:  '0x186A0'
      }]
    });
    await waitForReceipt(txHash);
    await refreshTickets();
    return true;
  } catch (e) {
    console.error('useTicket error:', e);
    showToast('❌ Không thể sử dụng ticket: ' + (e.message || 'unknown'));
    return false;
  }
}

// ── Transaction receipt polling ────────────────────────────

async function waitForReceipt(txHash, maxAttempts = 30) {
  const provider = activeProvider || window.ethereum;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    try {
      const receipt = await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      });
      if (receipt) {
        if (receipt.status === '0x1' || receipt.status === 1) return receipt;
        throw new Error('Transaction reverted on-chain');
      }
    } catch (e) {
      if (e.message.includes('reverted')) throw e;
    }
  }
  throw new Error('Transaction timeout – kiểm tra explorer: https://testnet.arcscan.app');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── UI helpers ─────────────────────────────────────────────

function updateWalletUI() {
  const addrEl      = document.getElementById('wallet-address');
  const connectBtn  = document.getElementById('wallet-btn');
  const disconnectBtn = document.getElementById('wallet-disconnect-btn');

  if (walletAddress) {
    const short = walletAddress.slice(0, 6) + '…' + walletAddress.slice(-4);

    if (addrEl) {
      addrEl.textContent  = short;
      addrEl.style.display = 'inline';
    }
    if (connectBtn) {
      connectBtn.textContent = '✅ Connected';
      connectBtn.classList.add('connected');
    }
    // Show disconnect button if it exists; otherwise inject one next to connect btn
    if (disconnectBtn) {
      disconnectBtn.style.display = 'inline-block';
    } else if (connectBtn) {
      _ensureDisconnectBtn(connectBtn);
    }
  } else {
    if (addrEl) addrEl.style.display = 'none';
    if (connectBtn) {
      connectBtn.textContent = '🔗 Connect Wallet';
      connectBtn.classList.remove('connected');
    }
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    const injected = document.getElementById('wallet-disconnect-btn');
    if (injected) injected.style.display = 'none';
  }
}

/**
 * Auto-inject a disconnect button right after the connect button
 * if the HTML does not already have one with id="wallet-disconnect-btn".
 */
function _ensureDisconnectBtn(connectBtn) {
  if (document.getElementById('wallet-disconnect-btn')) return;
  const btn = document.createElement('button');
  btn.id        = 'wallet-disconnect-btn';
  btn.textContent = '🔌 Ngắt kết nối';
  btn.onclick   = disconnectWallet;
  // Minimal inline style so it works without extra CSS
  btn.style.cssText = `
    margin-left: 8px; padding: 6px 14px; border-radius: 8px;
    background: #c0392b; color: #fff; border: none; cursor: pointer;
    font-size: 13px; font-weight: 600;
  `;
  connectBtn.parentNode.insertBefore(btn, connectBtn.nextSibling);
}

function updateTicketUI(count) {
  const t = typeof count === 'number' ? count : 0;
  document.querySelectorAll('.ticket-count').forEach(el => {
    el.textContent = t;
  });
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

// ── Modal ──────────────────────────────────────────────────

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

// ── Game guard ─────────────────────────────────────────────

async function requireTicket(lobbyPath = '../../index.html') {
  if (!walletAddress) {
    alert('🔗 Vui lòng kết nối ví trước!');
    window.location.href = lobbyPath;
    return false;
  }

  const count = await getTicketsOnChain();
  if (count < 1) {
    alert('🎟️ Bạn cần ít nhất 1 ticket để chơi!\nHãy mua ticket ở Lobby.');
    window.location.href = lobbyPath;
    return false;
  }

  const ok = await useTicket();
  if (!ok) {
    alert('❌ Không thể trừ ticket. Vui lòng thử lại.');
    return false;
  }

  return true;
}

// ── Init ───────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  updateWalletUI();
  updateTicketUI(0);

  // Try to restore previously connected wallet (if provider available)
  const providers = detectProviders();
  if (providers.length > 0) {
    const firstProvider = providers[0].provider;
    firstProvider.request({ method: 'eth_accounts' }).then(async accounts => {
      if (accounts.length) {
        walletAddress  = accounts[0];
        activeProvider = firstProvider;
        window.ethereum = firstProvider;
        // Auto switch to ARC for already-connected wallets
        try { await switchToARC(); } catch (_) {}
        updateWalletUI();
        await refreshTickets();
        attachProviderEvents(firstProvider);
      }
    }).catch(() => {});
  }
});

// ── Expose globals ─────────────────────────────────────────
window.SmicWallet = {
  connect:          connectWallet,
  disconnect:       disconnectWallet,
  buyTickets,
  getTickets:       getTicketsOnChain,
  useTicket,
  requireTicket,
  refreshTickets,
  openBuyModal,
  closeBuyModal,
  showToast,
  openWalletPicker,
  closeWalletPicker,
  switchToARC
};
