/**
 * reward-backend.js
 * Backend server (Node.js + Express) để ký xác nhận thưởng USDC.
 *
 * Cài đặt:
 *   npm install express ethers dotenv cors
 *
 * Tạo file .env:
 *   SIGNER_PRIVATE_KEY=0x...   ← private key ví signer (KHÔNG phải owner)
 *   REWARD_CONTRACT=0x...      ← địa chỉ contract sau khi deploy
 *   ARC_CHAIN_ID=5042002
 *   PORT=3001
 *
 * Chạy:
 *   node reward-backend.js
 *
 * Endpoint:
 *   POST /api/sign-reward
 *   Body: { player, amount, chainId, contract }
 *   Trả về: { amount, nonce, expiry, signature }
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors({ origin: '*' })); // Đổi thành domain game thực tế khi production
app.use(express.json());

// ── Config ────────────────────────────────────────────────
const SIGNER_KEY       = process.env.SIGNER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.REWARD_CONTRACT?.toLowerCase();
const CHAIN_ID         = parseInt(process.env.ARC_CHAIN_ID || '5042002');
const PORT             = parseInt(process.env.PORT || '3001');

if (!SIGNER_KEY)       { console.error('❌ Missing SIGNER_PRIVATE_KEY in .env'); process.exit(1); }
if (!CONTRACT_ADDRESS) { console.error('❌ Missing REWARD_CONTRACT in .env');    process.exit(1); }

const signerWallet = new ethers.Wallet(SIGNER_KEY);
console.log(`✅ Signer address: ${signerWallet.address}`);
console.log(`✅ Contract:       ${CONTRACT_ADDRESS}`);
console.log(`✅ Chain ID:       ${CHAIN_ID}`);

// ── Anti-abuse: rate limiting đơn giản ────────────────────
// Mỗi địa chỉ chỉ được nhận thưởng 1 lần mỗi 30 giây
const lastClaimTime = new Map();
const CLAIM_COOLDOWN_MS = 30_000;

// ── POST /api/sign-reward ─────────────────────────────────
app.post('/api/sign-reward', async (req, res) => {
  try {
    const { player, amount, chainId, contract } = req.body;

    // ── Validate input ──
    if (!player || !ethers.isAddress(player)) {
      return res.status(400).json({ message: 'Invalid player address' });
    }
    if (!Number.isInteger(amount) || amount < 1 || amount > 5) {
      return res.status(400).json({ message: 'Invalid reward amount (1-5)' });
    }
    if (chainId !== CHAIN_ID) {
      return res.status(400).json({ message: `Wrong chainId. Expected ${CHAIN_ID}` });
    }
    if (contract?.toLowerCase() !== CONTRACT_ADDRESS) {
      return res.status(400).json({ message: 'Wrong contract address' });
    }

    // ── Rate limit ──
    const now     = Date.now();
    const lastClaim = lastClaimTime.get(player.toLowerCase()) || 0;
    if (now - lastClaim < CLAIM_COOLDOWN_MS) {
      const waitSec = Math.ceil((CLAIM_COOLDOWN_MS - (now - lastClaim)) / 1000);
      return res.status(429).json({ message: `Vui lòng chờ ${waitSec}s trước khi nhận thưởng tiếp.` });
    }

    // ── Tạo nonce ngẫu nhiên và expiry ──
    const nonce       = BigInt('0x' + ethers.randomBytes(32).reduce((h, b) => h + b.toString(16).padStart(2,'0'), ''));
    const expiry      = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 phút
    const amountWei   = BigInt(amount) * BigInt(10 ** 6); // USDC 6 decimals

    // ── Tạo message hash (phải khớp với contract _buildMessageHash) ──
    // keccak256(abi.encodePacked(player, amountWei, nonce, expiry, chainId, contractAddress))
    const dataHash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [player, amountWei, nonce, expiry, BigInt(CHAIN_ID), CONTRACT_ADDRESS]
      )
    );

    // Ký với prefix "\x19Ethereum Signed Message:\n32" (khớp với EIP-191 trong contract)
    const signature = await signerWallet.signMessage(ethers.getBytes(dataHash));

    // ── Lưu thời điểm claim ──
    lastClaimTime.set(player.toLowerCase(), now);

    // ── Trả về frontend ──
    return res.json({
      amount:    Number(amountWei),  // wei amount để truyền vào contract
      nonce:     nonce.toString(),
      expiry:    expiry.toString(),
      signature
    });

  } catch (err) {
    console.error('sign-reward error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ── Health check ──────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, signer: signerWallet.address }));

app.listen(PORT, () => {
  console.log(`🚀 Reward backend running on http://localhost:${PORT}`);
});
