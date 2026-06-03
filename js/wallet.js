// ============================================================
//  wallet.js  –  ARC Testnet USDC Ticket System (On-Chain)
//  Chain ID    : 5042002 (0x4cef52)
//  USDC        : 0x3600000000000000000000000000000000000000  (6 decimals)
//  Treasury    : 0x4cd1d1b157f943feb2bebf2d36770ac3346e1128
//  TicketSystem: 0x441f311f2074df4070ea6229ee33E2224353F1cb
// ============================================================

const ARC_CHAIN_ID         = '0x4cef52';
const ARC_RPC              = 'https://rpc.testnet.arc.network';
const USDC_ADDRESS         = '0x3600000000000000000000000000000000000000';
const TREASURY_ADDRESS     = '0x4cd1d1b157f943feb2bebf2d36770ac3346e1128';
const TICKET_CONTRACT_ADDR = '0x441f311f2074df4070ea6229ee33E2224353F1cb';
const USDC_DECIMALS        = 6;

// ── ABI encoders ───────────────────────────────────────────

/**
 * Encode ERC-20 approve(address,uint256)
 * selector: keccak256("approve(address,uint256)") = 0x095ea7b3
 */
function encodeApprove(spender, amountWei) {
  const selector   = '095ea7b3';
  const paddedAddr = spender.toLowerCase().replace('0x', '').padStart(64, '0');
  const paddedAmt  = BigInt(amountWei).toString(16).padStart(64, '0');
  return '0x' + selector + paddedAddr + paddedAmt;
}

/**
 * Encode TicketSystem.buyTickets(uint256)
 * selector: keccak256("buyTickets(uint256)") = 0x27a29b4b
 */
function encodeBuyTickets(quantity) {
  const selector = '27a29b4b';
  const paddedQty = BigInt(quantity).toString(16).padStart(64, '0');
  return '0x' + selector + paddedQty;
}

/**
 * Encode TicketSystem.useTickets(uint256)
 * selector: keccak256("useTickets(uint256)") = 0x8f3b9b1c
 *
 * NOTE: Add a useTickets(uint256) function to your contract if you want
 * the frontend to deduct tickets on-chain when a game starts.
 * selector: keccak256("useTickets(uint256)") = 0x8f3b9b1c
 */
function encodeUseTickets(quantity) {
  const selector = '8f3b9b1c';
  const paddedQty = BigInt(quantity).toString(16).padStart(64, '0');
  return '0x' + selector + paddedQty;
}

/**
 * Encode userTickets(address) view call
 * selector: keccak256("userTickets(address)") = 0x83a26201
 */
function encodeUserTickets(account) {
  const selector   = '83a26201';
  const paddedAddr = account.toLowerCase().replace('0x', '').padStart(64, '0');
  return '0x' + selector + paddedAddr;
}

// ── State ──────────────────────────────────────────────────
let walletAddress = null;

// ── On-chain ticket reads ──────────────────────────────────

/**
 * Read userTickets(address) from the TicketSystem contract via eth_call.
 * Returns a Number (safe for ticket counts which won't exceed JS MAX_SAFE_INT).
 */
async function getTicketsOnChain(address) {
  const addr = address || walletAddress;
  if (!addr) return 0;
  try {
    const result = await window.ethereum.request({
      method: 'eth_call',
      params: [{
        to:   TICKET_CONTRACT_ADDR,
        data: encodeUserTickets(addr)
      }, 'latest']
    });
    // result is a 32-byte hex string → parse as BigInt, then Number
    return Number(BigInt(result));
  } catch (e) {
    console.error('getTicketsOnChain error:', e);
    return 0;
  }
}

/**
 * Convenience: fetch on-chain count and refresh the UI.
 */
async function refreshTickets() {
  const count = await getTicketsOnChain();
  updateTicketUI(count);
  return count;
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
    await refreshTickets();
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

// ── Buy tickets (approve → buyTickets) ────────────────────

/**
 * Two-step on-chain flow:
 *  1. approve(TicketSystem, totalCost) on the USDC contract
 *  2. buyTickets(quantity)             on the TicketSystem contract
 *
 * Both transactions are confirmed before proceeding.
 */
async function buyTickets(quantity) {
  if (!walletAddress) {
    const addr = await connectWallet();
    if (!addr) return false;
  }

  const totalCost = BigInt(quantity) * BigInt(10 ** USDC_DECIMALS); // 1 USDC each

  try {
    // ── Step 1: Approve ──────────────────────────────────
    showToast('🔐 Bước 1/2: Phê duyệt USDC…');
    const approveTx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to:   USDC_ADDRESS,
        data: encodeApprove(TICKET_CONTRACT_ADDR, totalCost.toString()),
        gas:  '0x186A0'   // 100,000 – bypass eth_estimateGas failures
      }]
    });

    showToast('⏳ Đang chờ xác nhận approve…');
    await waitForReceipt(approveTx);
    showToast('✅ Approve thành công!');

    // ── Step 2: buyTickets ───────────────────────────────
    showToast('🎟️ Bước 2/2: Mua vé on-chain…');
    const buyTx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to:   TICKET_CONTRACT_ADDR,
        data: encodeBuyTickets(quantity),
        gas:  '0x493E0'   // 300,000 – covers transferFrom + storage write
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
/**
 * Calls useTickets(1) on the contract.
 *
 * IMPORTANT: Your current TicketSystem contract does NOT have a useTickets()
 * function. You have two options:
 *
 *  Option A (Recommended) – Add to your contract:
 *    function useTickets(uint256 quantity) external {
 *        require(userTickets[msg.sender] >= quantity, "Not enough tickets");
 *        userTickets[msg.sender] -= quantity;
 *    }
 *    Then re-deploy and update TICKET_CONTRACT_ADDR above.
 *
 *  Option B – Deduct only inside game server / backend (off-chain).
 *    In this case, replace the body of useTicket() below with your API call
 *    and remove the on-chain tx entirely.
 *
 * The selector used here matches Option A's function signature.
 */
async function useTicket() {
  if (!walletAddress) return false;

  const current = await getTicketsOnChain();
  if (current < 1) return false;

  try {
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to:   TICKET_CONTRACT_ADDR,
        data: encodeUseTickets(1),
        gas:  '0x186A0'   // 100,000
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
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    try {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      });
      if (receipt) {
        if (receipt.status === '0x1' || receipt.status === 1) return receipt;
        throw new Error('Transaction reverted on-chain');
      }
    } catch (e) {
      if (e.message.includes('reverted')) throw e;
      // keep polling on network errors
    }
  }
  throw new Error('Transaction timeout – kiểm tra explorer: https://testnet.arcscan.app');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── UI helpers ─────────────────────────────────────────────

function updateWalletUI() {
  const el  = document.getElementById('wallet-address');
  const btn = document.getElementById('wallet-btn');
  if (!el || !btn) return;
  if (walletAddress) {
    const short = walletAddress.slice(0, 6) + '…' + walletAddress.slice(-4);
    el.textContent  = short;
    el.style.display = 'inline';
    btn.textContent  = '✅ Connected';
    btn.classList.add('connected');
  } else {
    el.style.display = 'none';
    btn.textContent  = '🔗 Connect Wallet';
    btn.classList.remove('connected');
  }
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
/**
 * Call at the top of each game page.
 * Checks on-chain balance, then calls useTickets(1) before allowing play.
 */
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
  updateTicketUI(0); // show 0 until wallet connects

  if (window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(async accounts => {
      if (accounts.length) {
        walletAddress = accounts[0];
        updateWalletUI();
        await refreshTickets();
      }
    });

    window.ethereum.on('accountsChanged', async accounts => {
      walletAddress = accounts[0] || null;
      updateWalletUI();
      if (walletAddress) {
        await refreshTickets();
      } else {
        updateTicketUI(0);
      }
    });

    window.ethereum.on('chainChanged', () => window.location.reload());
  }
});

// ── Expose globals ─────────────────────────────────────────
window.SmicWallet = {
  connect:       connectWallet,
  buyTickets,
  getTickets:    getTicketsOnChain,   // async now – returns Promise<number>
  useTicket,
  requireTicket,
  refreshTickets,
  openBuyModal,
  closeBuyModal,
  showToast
};
