'forge clean' running (wd: E:\arc-rent-lending\contracts)
'forge config --json' running
'forge build --build-info --deny never --skip ./test/** ./script/** --force' running (wd: E:\arc-rent-lending\contracts)
**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [missing-zero-check](#missing-zero-check) (1 results) (Low)
 - [timestamp](#timestamp) (4 results) (Low)
 - [naming-convention](#naming-convention) (4 results) (Informational)
## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-0
[RewardToken.setMinter(address)._minter](src/RewardToken.sol#L23) lacks a zero-check on :
		- [minter = _minter](src/RewardToken.sol#L24)

src/RewardToken.sol#L23


## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-1
[LendingPool.pendingRewards(uint8,address)](src/LendingPool.sol#L361-L375) uses timestamp for comparisons
	Dangerous comparisons:
	- [elapsed > 0 && p.totalDeposits > 0 && p.activeLoanCount > 0](src/LendingPool.sol#L368)
	- [accrued > li.rewardDebt](src/LendingPool.sol#L374)

src/LendingPool.sol#L361-L375


 - [ ] ID-2
[LendingPool.markDefault(uint256)](src/LendingPool.sol#L330-L347) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp <= l.dueTs](src/LendingPool.sol#L333)

src/LendingPool.sol#L330-L347


 - [ ] ID-3
[LendingPool.claimLoan(LendingPool.Attestation,bytes)](src/LendingPool.sol#L248-L306) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp > att.expiry](src/LendingPool.sol#L252)

src/LendingPool.sol#L248-L306


 - [ ] ID-4
[LendingPool._updatePool(uint8)](src/LendingPool.sol#L389-L401) uses timestamp for comparisons
	Dangerous comparisons:
	- [nowTs <= p.lastUpdateTs](src/LendingPool.sol#L392)

src/LendingPool.sol#L389-L401


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-5
Parameter [RewardToken.setMinter(address)._minter](src/RewardToken.sol#L23) is not in mixedCase

src/RewardToken.sol#L23


 - [ ] ID-6
Parameter [LendingPool.setTrustedAttestor(address)._attestor](src/LendingPool.sol#L175) is not in mixedCase

src/LendingPool.sol#L175


 - [ ] ID-7
Parameter [CollateralVault.setTrustedRelayer(address)._relayer](src/CollateralVault.sol#L59) is not in mixedCase

src/CollateralVault.sol#L59


 - [ ] ID-8
Parameter [LendingPool.setEscrowWallet(address)._escrow](src/LendingPool.sol#L181) is not in mixedCase

src/LendingPool.sol#L181


