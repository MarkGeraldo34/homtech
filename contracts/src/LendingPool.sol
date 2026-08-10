// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {RewardToken} from "./RewardToken.sol";

/// @title LendingPool
/// @notice NFT-collateral-gated USDC "rent" lending on Arc Testnet. Borrowers draw a fixed-tier
///         30-day loan after an off-chain oracle attests to their eligibility (cross-chain wallet
///         volume + a mainnet NFT's value/age) and locked that *same* NFT as collateral in the
///         companion CollateralVault — currently on Ethereum Sepolia while Arc is still testnet,
///         eventually Ethereum mainnet. Lenders fund a shared pool per tier and earn a streaming
///         RewardToken for as long as loans backed by that tier are outstanding.
/// @dev Collateral custody and seizure happen on the vault, driven by an off-chain relayer that
///      watches this contract's LoanRepaid/LoanDefaulted events. This contract never touches the
///      NFT directly — it only carries the reference (nftContract/tokenId/sepoliaDepositId) so
///      the relayer knows which deposit to unlock or seize.
contract LendingPool is Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    // --- Constants ---

    uint256 public constant TIER_COUNT = 5;
    uint256 public constant LOAN_DURATION = 30 days;
    uint256 public constant INTEREST_BPS = 1500; // 15%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    // dailyRate(tier) = tierAmount / 10 tokens/day. tierAmount is USDC (6 decimals),
    // RewardToken is 18 decimals, so: tierAmount * 1e18 / 1e6 / 10 == tierAmount * 1e11.
    uint256 public constant DAILY_RATE_SCALE = 1e11;

    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(address borrower,uint8 tierIndex,address nftContract,uint256 tokenId,bytes32 sepoliaDepositId,uint256 nonce,uint256 expiry)"
    );

    // --- Types ---

    struct Attestation {
        address borrower;
        uint8 tierIndex;
        address nftContract;
        uint256 tokenId;
        bytes32 sepoliaDepositId;
        uint256 nonce;
        uint256 expiry;
    }

    struct Pool {
        uint256 totalDeposits; // idle + on-loan USDC deposited by lenders
        uint256 totalOutstanding; // USDC currently out on loan
        uint256 activeLoanCount;
        uint256 accRewardPerShare; // scaled 1e18, per unit of totalDeposits
        uint256 lastUpdateTs;
        address treasury; // vault-side address seized NFTs for this tier are sent to (informational; consumed by the relayer)
    }

    struct LenderInfo {
        uint256 deposited;
        uint256 rewardDebt;
        uint256 pendingRewards;
    }

    struct Loan {
        address borrower;
        uint8 tierIndex;
        uint256 principal;
        uint256 startTs;
        uint256 dueTs;
        address nftContract;
        uint256 tokenId;
        bytes32 sepoliaDepositId;
        bool active;
        bool repaid;
        bool defaulted;
    }

    // --- Storage ---

    IERC20 public immutable usdc;
    RewardToken public immutable rewardToken;

    address public trustedAttestor;
    address public escrowWallet;

    uint256[TIER_COUNT] public tierAmounts;
    Pool[TIER_COUNT] public pools;

    mapping(uint8 => mapping(address => LenderInfo)) public lenderInfo; // tierIndex => lender => info
    mapping(address => bool) public blacklisted;
    mapping(address => mapping(uint256 => bool)) public usedAttestationNonce; // borrower => nonce => used
    mapping(address => uint256) public activeLoanOf; // borrower => loanId (0 = none)

    uint256 public loanCounter;
    mapping(uint256 => Loan) public loans;

    // --- Events ---

    event Deposited(uint8 indexed tierIndex, address indexed lender, uint256 amount);
    event Withdrawn(uint8 indexed tierIndex, address indexed lender, uint256 amount);
    event RewardsClaimed(uint8 indexed tierIndex, address indexed lender, uint256 amount);
    event LoanClaimed(
        uint256 indexed loanId,
        address indexed borrower,
        uint8 indexed tierIndex,
        uint256 principal,
        uint256 upfrontInterest,
        uint256 dueTs,
        bytes32 sepoliaDepositId
    );
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);
    event LoanDefaulted(
        uint256 indexed loanId,
        address indexed borrower,
        address nftContract,
        uint256 tokenId,
        bytes32 sepoliaDepositId,
        address treasury
    );
    event TrustedAttestorUpdated(address indexed attestor);
    event EscrowWalletUpdated(address indexed escrow);
    event TierTreasuryUpdated(uint8 indexed tierIndex, address indexed treasury);

    // --- Errors ---

    error InvalidTier();
    error Blacklisted();
    error BorrowerMismatch();
    error ActiveLoanExists();
    error AttestationExpired();
    error NonceAlreadyUsed();
    error BadAttestationSignature();
    error InsufficientPoolLiquidity();
    error LoanNotActive();
    error NotBorrower();
    error NotYetDue();
    error ZeroAddress();
    error ZeroAmount();
    error ExceedsDeposit();
    error ExceedsIdleLiquidity();
    error NothingToClaim();

    constructor(
        address initialOwner,
        address _usdc,
        address _trustedAttestor,
        address _escrowWallet,
        address[TIER_COUNT] memory _tierTreasuries
    ) Ownable(initialOwner) EIP712("ArcRentLendingPool", "1") {
        if (_usdc == address(0) || _trustedAttestor == address(0) || _escrowWallet == address(0)) {
            revert ZeroAddress();
        }
        usdc = IERC20(_usdc);
        trustedAttestor = _trustedAttestor;
        escrowWallet = _escrowWallet;
        rewardToken = new RewardToken(initialOwner);

        tierAmounts[0] = 200e6;
        tierAmounts[1] = 300e6;
        tierAmounts[2] = 400e6;
        tierAmounts[3] = 500e6;
        tierAmounts[4] = 600e6;

        for (uint8 i = 0; i < TIER_COUNT; i++) {
            pools[i].lastUpdateTs = block.timestamp;
            pools[i].treasury = _tierTreasuries[i];
        }
    }

    // --- Admin ---

    function setTrustedAttestor(address _attestor) external onlyOwner {
        if (_attestor == address(0)) revert ZeroAddress();
        trustedAttestor = _attestor;
        emit TrustedAttestorUpdated(_attestor);
    }

    function setEscrowWallet(address _escrow) external onlyOwner {
        if (_escrow == address(0)) revert ZeroAddress();
        escrowWallet = _escrow;
        emit EscrowWalletUpdated(_escrow);
    }

    function setTierTreasury(uint8 tierIndex, address treasury) external onlyOwner {
        _requireValidTier(tierIndex);
        if (treasury == address(0)) revert ZeroAddress();
        pools[tierIndex].treasury = treasury;
        emit TierTreasuryUpdated(tierIndex, treasury);
    }

    // --- Lender actions ---

    function deposit(uint8 tierIndex, uint256 amount) external nonReentrant {
        _requireValidTier(tierIndex);
        if (amount == 0) revert ZeroAmount();
        _settle(tierIndex, msg.sender);

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        Pool storage p = pools[tierIndex];
        LenderInfo storage li = lenderInfo[tierIndex][msg.sender];
        li.deposited += amount;
        p.totalDeposits += amount;
        li.rewardDebt = (li.deposited * p.accRewardPerShare) / 1e18;

        emit Deposited(tierIndex, msg.sender, amount);
    }

    function withdraw(uint8 tierIndex, uint256 amount) external nonReentrant {
        _requireValidTier(tierIndex);
        if (amount == 0) revert ZeroAmount();
        _settle(tierIndex, msg.sender);

        Pool storage p = pools[tierIndex];
        LenderInfo storage li = lenderInfo[tierIndex][msg.sender];
        if (amount > li.deposited) revert ExceedsDeposit();
        uint256 idle = p.totalDeposits - p.totalOutstanding;
        if (amount > idle) revert ExceedsIdleLiquidity();

        li.deposited -= amount;
        p.totalDeposits -= amount;
        li.rewardDebt = (li.deposited * p.accRewardPerShare) / 1e18;

        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(tierIndex, msg.sender, amount);
    }

    function claimRewards(uint8 tierIndex) external nonReentrant {
        _requireValidTier(tierIndex);
        _settle(tierIndex, msg.sender);

        LenderInfo storage li = lenderInfo[tierIndex][msg.sender];
        uint256 amount = li.pendingRewards;
        if (amount == 0) revert NothingToClaim();
        li.pendingRewards = 0;

        rewardToken.mint(msg.sender, amount);

        emit RewardsClaimed(tierIndex, msg.sender, amount);
    }

    // --- Borrower actions ---

    function claimLoan(Attestation calldata att, bytes calldata signature) external nonReentrant returns (uint256 loanId) {
        if (blacklisted[msg.sender]) revert Blacklisted();
        if (att.borrower != msg.sender) revert BorrowerMismatch();
        if (activeLoanOf[msg.sender] != 0) revert ActiveLoanExists();
        if (block.timestamp > att.expiry) revert AttestationExpired();
        if (usedAttestationNonce[msg.sender][att.nonce]) revert NonceAlreadyUsed();
        _requireValidTier(att.tierIndex);

        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                att.borrower,
                att.tierIndex,
                att.nftContract,
                att.tokenId,
                att.sepoliaDepositId,
                att.nonce,
                att.expiry
            )
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (signer != trustedAttestor) revert BadAttestationSignature();

        usedAttestationNonce[msg.sender][att.nonce] = true;

        uint256 principal = tierAmounts[att.tierIndex];
        uint256 upfrontInterest = (principal * INTEREST_BPS) / BPS_DENOMINATOR;

        Pool storage p = pools[att.tierIndex];
        uint256 idle = p.totalDeposits - p.totalOutstanding;
        if (idle < principal) revert InsufficientPoolLiquidity();

        _updatePool(att.tierIndex);
        p.totalOutstanding += principal;
        p.activeLoanCount += 1;

        loanId = ++loanCounter;
        uint256 dueTs = block.timestamp + LOAN_DURATION;
        loans[loanId] = Loan({
            borrower: msg.sender,
            tierIndex: att.tierIndex,
            principal: principal,
            startTs: block.timestamp,
            dueTs: dueTs,
            nftContract: att.nftContract,
            tokenId: att.tokenId,
            sepoliaDepositId: att.sepoliaDepositId,
            active: true,
            repaid: false,
            defaulted: false
        });
        activeLoanOf[msg.sender] = loanId;

        // 15% upfront interest, paid before the principal is released
        usdc.safeTransferFrom(msg.sender, escrowWallet, upfrontInterest);
        usdc.safeTransfer(msg.sender, principal);

        emit LoanClaimed(loanId, msg.sender, att.tierIndex, principal, upfrontInterest, dueTs, att.sepoliaDepositId);
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (!l.active) revert LoanNotActive();
        if (l.borrower != msg.sender) revert NotBorrower();

        l.active = false;
        l.repaid = true;
        activeLoanOf[msg.sender] = 0;

        Pool storage p = pools[l.tierIndex];
        _updatePool(l.tierIndex);
        p.totalOutstanding -= l.principal;
        p.activeLoanCount -= 1;

        usdc.safeTransferFrom(msg.sender, address(this), l.principal);

        emit LoanRepaid(loanId, msg.sender);
    }

    /// @notice Callable by anyone once a loan is past due and unpaid. Blacklists the borrower and
    ///         socializes the unpaid principal as a loss to the tier pool's lenders (the seized
    ///         collateral, relayed to the vault, is the offsetting recovery).
    function markDefault(uint256 loanId) external nonReentrant {
        Loan storage l = loans[loanId];
        if (!l.active) revert LoanNotActive();
        if (block.timestamp <= l.dueTs) revert NotYetDue();

        l.active = false;
        l.defaulted = true;
        blacklisted[l.borrower] = true;
        activeLoanOf[l.borrower] = 0;

        Pool storage p = pools[l.tierIndex];
        _updatePool(l.tierIndex);
        p.totalOutstanding -= l.principal;
        p.totalDeposits -= l.principal;
        p.activeLoanCount -= 1;

        emit LoanDefaulted(loanId, l.borrower, l.nftContract, l.tokenId, l.sepoliaDepositId, p.treasury);
    }

    // --- Views ---

    function tierAmount(uint8 tierIndex) external view returns (uint256) {
        _requireValidTier(tierIndex);
        return tierAmounts[tierIndex];
    }

    function dailyRewardRate(uint8 tierIndex) public view returns (uint256) {
        _requireValidTier(tierIndex);
        return tierAmounts[tierIndex] * DAILY_RATE_SCALE;
    }

    function pendingRewards(uint8 tierIndex, address lender) external view returns (uint256) {
        _requireValidTier(tierIndex);
        Pool storage p = pools[tierIndex];
        LenderInfo storage li = lenderInfo[tierIndex][lender];

        uint256 accRewardPerShare = p.accRewardPerShare;
        uint256 elapsed = block.timestamp - p.lastUpdateTs;
        if (elapsed > 0 && p.totalDeposits > 0 && p.activeLoanCount > 0) {
            accRewardPerShare +=
                (dailyRewardRate(tierIndex) * p.activeLoanCount * elapsed * 1e18) / (1 days * p.totalDeposits);
        }

        uint256 accrued = (li.deposited * accRewardPerShare) / 1e18;
        return li.pendingRewards + (accrued > li.rewardDebt ? accrued - li.rewardDebt : 0);
    }

    function idleLiquidity(uint8 tierIndex) external view returns (uint256) {
        _requireValidTier(tierIndex);
        Pool storage p = pools[tierIndex];
        return p.totalDeposits - p.totalOutstanding;
    }

    // --- Internal ---

    function _requireValidTier(uint8 tierIndex) internal pure {
        if (tierIndex >= TIER_COUNT) revert InvalidTier();
    }

    function _updatePool(uint8 tierIndex) internal {
        Pool storage p = pools[tierIndex];
        uint256 nowTs = block.timestamp;
        if (nowTs <= p.lastUpdateTs) {
            return;
        }
        uint256 elapsed = nowTs - p.lastUpdateTs;
        if (p.totalDeposits > 0 && p.activeLoanCount > 0) {
            p.accRewardPerShare +=
                (dailyRewardRate(tierIndex) * p.activeLoanCount * elapsed * 1e18) / (1 days * p.totalDeposits);
        }
        p.lastUpdateTs = nowTs;
    }

    function _settle(uint8 tierIndex, address lender) internal {
        _updatePool(tierIndex);
        Pool storage p = pools[tierIndex];
        LenderInfo storage li = lenderInfo[tierIndex][lender];
        uint256 accrued = (li.deposited * p.accRewardPerShare) / 1e18;
        if (accrued > li.rewardDebt) {
            li.pendingRewards += accrued - li.rewardDebt;
        }
        li.rewardDebt = accrued;
    }
}
