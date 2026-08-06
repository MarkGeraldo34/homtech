// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CollateralVault
/// @notice Currently deployed on Ethereum Sepolia while Arc itself is still testnet (see
///         DeploySepolia.s.sol / DeployMainnet.s.sol). Holds the borrower's NFT — the exact
///         nftContract/tokenId already checked for eligibility (value + hold-duration) — locked
///         as loan collateral for the companion LendingPool on Arc Testnet, the same way it will
///         on mainnet once Arc and this vault are production-ready. This vault has no knowledge
///         of Arc — it is driven entirely by a trusted relayer (the off-chain oracle/relayer
///         service) that watches LendingPool's LoanRepaid/LoanDefaulted events and calls
///         unlockCollateral or seizeCollateral accordingly.
/// @dev The borrower approves and locks the exact nftContract/tokenId the oracle service already
///      verified for eligibility — there is no separate stand-in asset. Point this at Ethereum
///      mainnet only after an independent security audit.
contract CollateralVault is IERC721Receiver, Ownable, ReentrancyGuard {
    struct Deposit {
        address borrower;
        address nftContract;
        uint256 tokenId;
        bytes32 arcLoanRef; // correlator supplied by the borrower/oracle (e.g. matches the attestation nonce)
        bool locked;
    }

    address public trustedRelayer;

    mapping(bytes32 => Deposit) public deposits; // depositId => Deposit
    mapping(address => mapping(uint256 => bytes32)) public activeDepositOf; // nftContract => tokenId => depositId

    event Locked(
        bytes32 indexed depositId, address indexed borrower, address indexed nftContract, uint256 tokenId, bytes32 arcLoanRef
    );
    event Unlocked(bytes32 indexed depositId, address indexed borrower, address indexed nftContract, uint256 tokenId);
    event Seized(
        bytes32 indexed depositId, address indexed borrower, address indexed nftContract, uint256 tokenId, address treasury
    );
    event TrustedRelayerUpdated(address indexed relayer);

    error NotRelayer();
    error NotLocked();
    error AlreadyLocked();
    error ZeroAddress();

    constructor(address initialOwner, address _trustedRelayer) Ownable(initialOwner) {
        if (_trustedRelayer == address(0)) revert ZeroAddress();
        trustedRelayer = _trustedRelayer;
    }

    modifier onlyRelayer() {
        if (msg.sender != trustedRelayer) revert NotRelayer();
        _;
    }

    function setTrustedRelayer(address _relayer) external onlyOwner {
        if (_relayer == address(0)) revert ZeroAddress();
        trustedRelayer = _relayer;
        emit TrustedRelayerUpdated(_relayer);
    }

    /// @notice Locks an NFT the caller owns as loan collateral. Returns the depositId the caller
    ///         (or the oracle service watching the Locked event) passes along as `sepoliaDepositId`
    ///         in the Arc-side eligibility attestation.
    function lockCollateral(address nftContract, uint256 tokenId, bytes32 arcLoanRef)
        external
        nonReentrant
        returns (bytes32 depositId)
    {
        if (activeDepositOf[nftContract][tokenId] != bytes32(0)) revert AlreadyLocked();

        depositId = keccak256(abi.encode(nftContract, tokenId, msg.sender, arcLoanRef, block.timestamp, block.prevrandao));
        deposits[depositId] = Deposit({
            borrower: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            arcLoanRef: arcLoanRef,
            locked: true
        });
        activeDepositOf[nftContract][tokenId] = depositId;

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        emit Locked(depositId, msg.sender, nftContract, tokenId, arcLoanRef);
    }

    /// @notice Returns the NFT to its original borrower once the relayer has observed the
    ///         matching loan being repaid on Arc.
    function unlockCollateral(bytes32 depositId) external onlyRelayer nonReentrant {
        Deposit storage d = deposits[depositId];
        if (!d.locked) revert NotLocked();

        d.locked = false;
        activeDepositOf[d.nftContract][d.tokenId] = bytes32(0);

        IERC721(d.nftContract).safeTransferFrom(address(this), d.borrower, d.tokenId);

        emit Unlocked(depositId, d.borrower, d.nftContract, d.tokenId);
    }

    /// @notice Sends the NFT to the tier's pool treasury once the relayer has observed the
    ///         matching loan defaulting on Arc.
    function seizeCollateral(bytes32 depositId, address treasury) external onlyRelayer nonReentrant {
        if (treasury == address(0)) revert ZeroAddress();
        Deposit storage d = deposits[depositId];
        if (!d.locked) revert NotLocked();

        d.locked = false;
        activeDepositOf[d.nftContract][d.tokenId] = bytes32(0);

        IERC721(d.nftContract).safeTransferFrom(address(this), treasury, d.tokenId);

        emit Seized(depositId, d.borrower, d.nftContract, d.tokenId, treasury);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
