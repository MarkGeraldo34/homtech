// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {RewardToken} from "../src/RewardToken.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract LendingPoolTest is Test {
    LendingPool internal pool;
    RewardToken internal rewardToken;
    MockUSDC internal usdc;

    uint256 internal attestorKey = 0xA11CE;
    address internal attestor;

    address internal owner = address(this);
    address internal escrow = address(0xE5C40);
    address internal lender1 = address(0x1111);
    address internal lender2 = address(0x2222);
    address internal borrower = address(0xB0B);

    address internal nftContract = address(0xBEEF000000000000000000000000000000BEEF);
    uint256 internal tokenId = 1;

    bytes32 internal constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(address borrower,uint8 tierIndex,address nftContract,uint256 tokenId,bytes32 sepoliaDepositId,uint256 nonce,uint256 expiry)"
    );

    function setUp() public {
        attestor = vm.addr(attestorKey);
        usdc = new MockUSDC();

        address[5] memory treasuries = [address(0xA0), address(0xA1), address(0xA2), address(0xA3), address(0xA4)];
        pool = new LendingPool(owner, address(usdc), attestor, escrow, treasuries);
        rewardToken = pool.rewardToken();
        rewardToken.setMinter(address(pool));

        usdc.mint(lender1, 10_000e6);
        usdc.mint(lender2, 10_000e6);
        usdc.mint(borrower, 10_000e6);

        vm.prank(lender1);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(lender2);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(borrower);
        usdc.approve(address(pool), type(uint256).max);
    }

    // --- helpers ---

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ArcRentLendingPool")),
                keccak256(bytes("1")),
                block.chainid,
                address(pool)
            )
        );
    }

    function _signAttestation(LendingPool.Attestation memory att) internal view returns (bytes memory) {
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
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _buildAttestation(uint8 tierIndex, uint256 nonce) internal view returns (LendingPool.Attestation memory) {
        return LendingPool.Attestation({
            borrower: borrower,
            tierIndex: tierIndex,
            nftContract: nftContract,
            tokenId: tokenId,
            sepoliaDepositId: keccak256("deposit-1"),
            nonce: nonce,
            expiry: block.timestamp + 15 minutes
        });
    }

    function _deposit(address lender, uint8 tierIndex, uint256 amount) internal {
        vm.prank(lender);
        pool.deposit(tierIndex, amount);
    }

    // --- deposit / withdraw ---

    function test_deposit_updatesPoolAndLenderBalances() public {
        _deposit(lender1, 0, 1_000e6);

        (uint256 totalDeposits,,,,,) = pool.pools(0);
        assertEq(totalDeposits, 1_000e6);
        assertEq(usdc.balanceOf(address(pool)), 1_000e6);
    }

    function test_withdraw_returnsIdleLiquidity() public {
        _deposit(lender1, 0, 1_000e6);

        vm.prank(lender1);
        pool.withdraw(0, 400e6);

        assertEq(usdc.balanceOf(lender1), 10_000e6 - 1_000e6 + 400e6);
        assertEq(pool.idleLiquidity(0), 600e6);
    }

    function test_withdraw_revertsWhenExceedingIdleLiquidity() public {
        _deposit(lender1, 0, 1_000e6);
        _claimLoanForBorrower(0, 1);

        // 200 of the 1000 is now on loan; idle is 800
        vm.prank(lender1);
        vm.expectRevert(LendingPool.ExceedsIdleLiquidity.selector);
        pool.withdraw(0, 900e6);
    }

    // --- claimLoan ---

    function _claimLoanForBorrower(uint8 tierIndex, uint256 nonce) internal returns (uint256 loanId) {
        LendingPool.Attestation memory att = _buildAttestation(tierIndex, nonce);
        bytes memory sig = _signAttestation(att);
        vm.prank(borrower);
        loanId = pool.claimLoan(att, sig);
    }

    function test_claimLoan_transfersPrincipalAndPullsUpfrontInterest() public {
        _deposit(lender1, 0, 1_000e6);

        uint256 borrowerBalBefore = usdc.balanceOf(borrower);
        uint256 loanId = _claimLoanForBorrower(0, 1);

        // principal = 200e6, interest = 15% of 200e6 = 30e6
        assertEq(usdc.balanceOf(borrower), borrowerBalBefore + 200e6 - 30e6);
        assertEq(usdc.balanceOf(escrow), 30e6);
        assertEq(pool.activeLoanOf(borrower), loanId);

        (,, uint256 activeLoanCount,,,) = pool.pools(0);
        assertEq(activeLoanCount, 1);
    }

    function test_claimLoan_revertsOnBadSignature() public {
        _deposit(lender1, 0, 1_000e6);
        LendingPool.Attestation memory att = _buildAttestation(0, 1);

        uint256 wrongKey = 0xBAD;
        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH, att.borrower, att.tierIndex, att.nftContract, att.tokenId, att.sepoliaDepositId, att.nonce, att.expiry
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.BadAttestationSignature.selector);
        pool.claimLoan(att, badSig);
    }

    function test_claimLoan_revertsOnExpiredAttestation() public {
        _deposit(lender1, 0, 1_000e6);
        LendingPool.Attestation memory att = _buildAttestation(0, 1);
        att.expiry = block.timestamp; // will be expired once we warp
        bytes memory sig = _signAttestation(att);

        vm.warp(block.timestamp + 1);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.AttestationExpired.selector);
        pool.claimLoan(att, sig);
    }

    function test_claimLoan_revertsOnReusedNonce() public {
        _deposit(lender1, 0, 2_000e6);
        uint256 loanId = _claimLoanForBorrower(0, 1);

        vm.prank(borrower);
        pool.repayLoan(loanId);

        LendingPool.Attestation memory att = _buildAttestation(0, 1); // same nonce again
        bytes memory sig = _signAttestation(att);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.NonceAlreadyUsed.selector);
        pool.claimLoan(att, sig);
    }

    function test_claimLoan_revertsWhenBorrowerAlreadyHasActiveLoan() public {
        _deposit(lender1, 0, 2_000e6);
        _claimLoanForBorrower(0, 1);

        LendingPool.Attestation memory att = _buildAttestation(0, 2);
        bytes memory sig = _signAttestation(att);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.ActiveLoanExists.selector);
        pool.claimLoan(att, sig);
    }

    function test_claimLoan_revertsWhenBlacklisted() public {
        _deposit(lender1, 0, 1_000e6);
        uint256 loanId = _claimLoanForBorrower(0, 1);

        vm.warp(block.timestamp + 31 days);
        pool.markDefault(loanId);

        LendingPool.Attestation memory att = _buildAttestation(0, 2);
        bytes memory sig = _signAttestation(att);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.Blacklisted.selector);
        pool.claimLoan(att, sig);
    }

    function test_claimLoan_revertsOnInsufficientLiquidity() public {
        _deposit(lender1, 0, 100e6); // less than the 200e6 tier amount

        LendingPool.Attestation memory att = _buildAttestation(0, 1);
        bytes memory sig = _signAttestation(att);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.InsufficientPoolLiquidity.selector);
        pool.claimLoan(att, sig);
    }

    // --- repay ---

    function test_repayLoan_returnsFundsAndFreesBorrower() public {
        _deposit(lender1, 0, 1_000e6);
        uint256 loanId = _claimLoanForBorrower(0, 1);

        vm.prank(borrower);
        pool.repayLoan(loanId);

        assertEq(pool.activeLoanOf(borrower), 0);
        assertEq(pool.idleLiquidity(0), 1_000e6);
        (,, uint256 activeLoanCount,,,) = pool.pools(0);
        assertEq(activeLoanCount, 0);
    }

    function test_repayLoan_revertsForNonBorrower() public {
        _deposit(lender1, 0, 1_000e6);
        uint256 loanId = _claimLoanForBorrower(0, 1);

        vm.prank(lender1);
        vm.expectRevert(LendingPool.NotBorrower.selector);
        pool.repayLoan(loanId);
    }

    // --- default ---

    function test_markDefault_blacklistsAndSocializesLoss() public {
        _deposit(lender1, 0, 1_000e6);
        uint256 loanId = _claimLoanForBorrower(0, 1);

        vm.warp(block.timestamp + 30 days + 1);
        pool.markDefault(loanId);

        assertTrue(pool.blacklisted(borrower));
        (uint256 totalDeposits, uint256 totalOutstanding,,,,) = pool.pools(0);
        assertEq(totalOutstanding, 0);
        assertEq(totalDeposits, 800e6); // 1000 - 200 principal lost
    }

    function test_markDefault_revertsBeforeDueDate() public {
        _deposit(lender1, 0, 1_000e6);
        uint256 loanId = _claimLoanForBorrower(0, 1);

        vm.expectRevert(LendingPool.NotYetDue.selector);
        pool.markDefault(loanId);
    }

    // --- reward accrual ---

    function test_rewardAccrual_singleLenderFullDay() public {
        _deposit(lender1, 0, 1_000e6); // lender1 owns 100% of the tier-0 pool
        _claimLoanForBorrower(0, 1); // 1 active loan, daily rate = 20 tokens/day

        vm.warp(block.timestamp + 1 days);

        uint256 pending = pool.pendingRewards(0, lender1);
        assertApproxEqAbs(pending, 20e18, 1e12);
    }

    function test_rewardAccrual_splitProRataAcrossLenders() public {
        _deposit(lender1, 0, 750e6); // 75% share
        _deposit(lender2, 0, 250e6); // 25% share
        _claimLoanForBorrower(0, 1);

        vm.warp(block.timestamp + 1 days);

        uint256 pending1 = pool.pendingRewards(0, lender1);
        uint256 pending2 = pool.pendingRewards(0, lender2);
        assertApproxEqAbs(pending1, 15e18, 1e12); // 75% of 20
        assertApproxEqAbs(pending2, 5e18, 1e12); // 25% of 20
    }

    function test_claimRewards_mintsTokensAndResetsPending() public {
        _deposit(lender1, 0, 1_000e6);
        _claimLoanForBorrower(0, 1);

        vm.warp(block.timestamp + 1 days);

        vm.prank(lender1);
        pool.claimRewards(0);

        assertApproxEqAbs(rewardToken.balanceOf(lender1), 20e18, 1e12);
        assertEq(pool.pendingRewards(0, lender1), 0);
    }

    function test_rewardAccrual_stopsAfterRepayment() public {
        _deposit(lender1, 0, 1_000e6);
        uint256 loanId = _claimLoanForBorrower(0, 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(borrower);
        pool.repayLoan(loanId);

        uint256 pendingRightAfterRepay = pool.pendingRewards(0, lender1);

        vm.warp(block.timestamp + 1 days);
        uint256 pendingOneDayLater = pool.pendingRewards(0, lender1);

        // no new loans outstanding, so rewards should not have grown further
        assertEq(pendingRightAfterRepay, pendingOneDayLater);
    }

    function test_rewardAccrual_multipleActiveLoansScaleLinearly() public {
        _deposit(lender1, 0, 2_000e6);
        _claimLoanForBorrower(0, 1);
        _claimLoanForOtherBorrower(0, 2, address(0xB0B2));

        vm.warp(block.timestamp + 1 days);

        uint256 pending = pool.pendingRewards(0, lender1);
        assertApproxEqAbs(pending, 40e18, 1e12); // 2 active loans * 20/day
    }

    function _claimLoanForOtherBorrower(uint8 tierIndex, uint256 nonce, address otherBorrower) internal {
        usdc.mint(otherBorrower, 1_000e6);
        vm.prank(otherBorrower);
        usdc.approve(address(pool), type(uint256).max);

        LendingPool.Attestation memory att = LendingPool.Attestation({
            borrower: otherBorrower,
            tierIndex: tierIndex,
            nftContract: nftContract,
            tokenId: tokenId + nonce,
            sepoliaDepositId: keccak256(abi.encodePacked("deposit", nonce)),
            nonce: nonce,
            expiry: block.timestamp + 15 minutes
        });
        bytes memory sig = _signAttestation2(att);
        vm.prank(otherBorrower);
        pool.claimLoan(att, sig);
    }

    function _signAttestation2(LendingPool.Attestation memory att) internal view returns (bytes memory) {
        return _signAttestation(att);
    }

    // --- admin setters / views ---

    function test_constructor_revertsOnZeroAddress() public {
        address[5] memory treasuries = [address(0xA0), address(0xA1), address(0xA2), address(0xA3), address(0xA4)];
        vm.expectRevert(LendingPool.ZeroAddress.selector);
        new LendingPool(owner, address(0), attestor, escrow, treasuries);
    }

    function test_setTrustedAttestor_updatesAttestorAndRevertsOnZero() public {
        vm.expectRevert(LendingPool.ZeroAddress.selector);
        pool.setTrustedAttestor(address(0));

        pool.setTrustedAttestor(address(0x9999));
        assertEq(pool.trustedAttestor(), address(0x9999));
    }

    function test_setEscrowWallet_updatesEscrowAndRevertsOnZero() public {
        vm.expectRevert(LendingPool.ZeroAddress.selector);
        pool.setEscrowWallet(address(0));

        pool.setEscrowWallet(address(0x9999));
        assertEq(pool.escrowWallet(), address(0x9999));
    }

    function test_setTierTreasury_updatesTreasuryAndRevertsOnZero() public {
        vm.expectRevert(LendingPool.ZeroAddress.selector);
        pool.setTierTreasury(0, address(0));

        pool.setTierTreasury(0, address(0x9999));
        (,,,,, address treasury) = pool.pools(0);
        assertEq(treasury, address(0x9999));
    }

    function test_tierAmount_returnsConfiguredAmounts() public view {
        assertEq(pool.tierAmount(0), 200e6);
        assertEq(pool.tierAmount(4), 600e6);
    }

    // --- validation reverts ---

    function test_deposit_revertsOnZeroAmount() public {
        vm.prank(lender1);
        vm.expectRevert(LendingPool.ZeroAmount.selector);
        pool.deposit(0, 0);
    }

    function test_deposit_revertsOnInvalidTier() public {
        vm.prank(lender1);
        vm.expectRevert(LendingPool.InvalidTier.selector);
        pool.deposit(5, 100e6);
    }

    function test_withdraw_revertsOnZeroAmount() public {
        vm.prank(lender1);
        vm.expectRevert(LendingPool.ZeroAmount.selector);
        pool.withdraw(0, 0);
    }

    function test_withdraw_revertsWhenExceedingDeposit() public {
        _deposit(lender1, 0, 500e6);

        vm.prank(lender1);
        vm.expectRevert(LendingPool.ExceedsDeposit.selector);
        pool.withdraw(0, 600e6);
    }

    function test_claimRewards_revertsWhenNothingToClaim() public {
        vm.prank(lender1);
        vm.expectRevert(LendingPool.NothingToClaim.selector);
        pool.claimRewards(0);
    }

    function test_claimLoan_revertsOnBorrowerMismatch() public {
        LendingPool.Attestation memory att = _buildAttestation(0, 1);
        att.borrower = address(0x9999);
        bytes memory sig = _signAttestation(att);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.BorrowerMismatch.selector);
        pool.claimLoan(att, sig);
    }

    function test_repayLoan_revertsWhenNotActive() public {
        vm.expectRevert(LendingPool.LoanNotActive.selector);
        pool.repayLoan(0);
    }

    function test_markDefault_revertsWhenNotActive() public {
        vm.expectRevert(LendingPool.LoanNotActive.selector);
        pool.markDefault(0);
    }
}
