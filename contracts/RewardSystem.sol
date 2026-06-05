// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  RewardSystem
 * @notice Phát thưởng USDC cho người chơi thắng trận.
 *         Chỉ phát khi có chữ ký hợp lệ từ backend (signer).
 *
 * Bảo mật:
 *  - Mỗi lần thắng backend cấp một (nonce, expiry, signature) dùng 1 lần.
 *  - Contract lưu nonce đã dùng → chặn replay attack.
 *  - Chữ ký expire sau 5 phút → chặn delay attack.
 *  - Chữ ký gồm: player + amount + nonce + expiry + chainId + contractAddress
 *    → chặn cross-chain và cross-contract attack.
 *
 * Deploy trên ARC Testnet:
 *  constructor(_signer = địa chỉ ví backend dùng để ký)
 *  Sau khi deploy: nạp USDC vào contract để làm quỹ thưởng
 *  Cập nhật REWARD_CONTRACT_ADDR trong wallet.js
 */
contract RewardSystem is Ownable {

    IERC20 public immutable usdc;
    address public signer;              // địa chỉ ví backend dùng để ký

    uint256 public constant MAX_REWARD  = 5 * 10**6;   // 5 USDC
    uint256 public constant MIN_REWARD  = 1 * 10**6;   // 1 USDC

    mapping(uint256 => bool) public usedNonces;  // nonce → đã dùng chưa

    // ── Events ──────────────────────────────────────────────
    event RewardClaimed(address indexed player, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event FundsDeposited(uint256 amount);
    event FundsWithdrawn(uint256 amount);

    // ── Constructor ─────────────────────────────────────────
    constructor(address initialOwner, address _signer) Ownable(initialOwner) {
        require(_signer != address(0), "Signer zero address");
        usdc   = IERC20(0x3600000000000000000000000000000000000000);
        signer = _signer;
    }

    // ── Core: claimReward ────────────────────────────────────

    /**
     * @notice Người chơi gọi sau khi thắng, kèm chữ ký do backend cấp.
     * @param amount    Số USDC (tính theo wei, 6 decimals). Ví dụ: 3 USDC = 3_000_000
     * @param nonce     Số ngẫu nhiên do backend tạo, dùng 1 lần
     * @param expiry    Timestamp hết hạn (Unix seconds)
     * @param signature Chữ ký ECDSA 65 bytes từ backend
     */
    function claimReward(
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external {
        // 1. Kiểm tra amount hợp lệ
        require(amount >= MIN_REWARD && amount <= MAX_REWARD, "Invalid reward amount");

        // 2. Chưa hết hạn
        require(block.timestamp <= expiry, "Signature expired");

        // 3. Nonce chưa dùng (chống replay)
        require(!usedNonces[nonce], "Nonce already used");

        // 4. Verify chữ ký
        bytes32 msgHash = _buildMessageHash(msg.sender, amount, nonce, expiry);
        require(_recoverSigner(msgHash, signature) == signer, "Invalid signature");

        // 5. Đánh dấu nonce đã dùng
        usedNonces[nonce] = true;

        // 6. Chuyển USDC
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient reward pool");
        bool ok = usdc.transfer(msg.sender, amount);
        require(ok, "USDC transfer failed");

        emit RewardClaimed(msg.sender, amount, nonce);
    }

    // ── Message hash ─────────────────────────────────────────

    /**
     * @dev Xây dựng message hash để verify.
     *      Bao gồm chainId và address(this) để chặn cross-chain/cross-contract replay.
     */
    function _buildMessageHash(
        address player,
        uint256 amount,
        uint256 nonce,
        uint256 expiry
    ) internal view returns (bytes32) {
        bytes32 dataHash = keccak256(abi.encodePacked(
            player,
            amount,
            nonce,
            expiry,
            block.chainid,
            address(this)
        ));
        // Ethereum Signed Message prefix (EIP-191)
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
    }

    // ── ECDSA recover ─────────────────────────────────────────

    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8   v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid v value");
        return ecrecover(hash, v, r, s);
    }

    // ── View helper ──────────────────────────────────────────

    /// Xem quỹ thưởng còn bao nhiêu USDC
    function poolBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // ── Admin ────────────────────────────────────────────────

    /// Owner đổi địa chỉ signer (ví backend)
    function setSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Zero address");
        emit SignerUpdated(signer, _newSigner);
        signer = _newSigner;
    }

    /// Owner nạp USDC vào quỹ (approve trước)
    function depositFunds(uint256 amount) external onlyOwner {
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        require(ok, "Deposit failed");
        emit FundsDeposited(amount);
    }

    /// Owner rút USDC khỏi quỹ
    function withdrawFunds(uint256 amount) external onlyOwner {
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        bool ok = usdc.transfer(msg.sender, amount);
        require(ok, "Withdraw failed");
        emit FundsWithdrawn(amount);
    }
    receive() external payable {
    emit FundsDeposited(msg.value);   // optional
    }
}
