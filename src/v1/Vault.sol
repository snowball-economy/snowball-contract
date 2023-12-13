// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract Vault is ERC20, IERC4626 {
    using Math for uint256;
    ERC20 private immutable _asset;
    uint8 private immutable _underlyingDecimals;
    uint8 public sharePoolRatio; // share pool ratio (the ratio to send to share pool, base = 100)
    uint8 public shareDiluteRatio; // share dilute ratio (the ratio of dilute share)
    address public creator;
    address public controller;
    uint256 public reserveBalance;
    uint256 public sharePool;

    // event definition
    event Claim(address indexed creator, uint256 assets);

    constructor(
        address creator_,
        address asset_,
        string memory name_,
        string memory symbol_,
        uint8 sharePoolRatio_,
        uint8 shareDiluteRatio_
    ) ERC20(name_, symbol_) {
        require(sharePoolRatio_ <= 100 && sharePoolRatio_ > 0, "share pool ratio should <=100 & >0");
        require(shareDiluteRatio_ <= 100 && sharePoolRatio_ > 0, "dilute ratio should <=100 & >0");

        controller = msg.sender;
        creator = creator_;

        _asset = ERC20(asset_);
        _underlyingDecimals = 18;

        sharePoolRatio = sharePoolRatio_;
        shareDiluteRatio = shareDiluteRatio_;

        reserveBalance = 0;
        sharePool = 0;
    }

    function getController() public view returns (address) {
        return controller;
    }

    function asset() public view virtual override returns (address) {
        return address(_asset);
    }

    function decimals() public view virtual override(IERC20Metadata, ERC20) returns (uint8) {
        return _underlyingDecimals + _decimalsOffset();
    }

    /** @dev See {IERC4626-totalAssets}. */
    function totalAssets() public view virtual override returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    function totalSharePoolAssets() public view virtual returns (uint256) {
        uint256 tAssets = _asset.balanceOf(address(this));
        return (tAssets - reserveBalance);
    }

    /** @dev See {IERC4626-convertToShares}. */
    function convertToShares(uint256 assets) public view virtual override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Down);
    }

    /** @dev See {IERC4626-convertToAssets}. */
    function convertToAssets(uint256 shares) public view virtual override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Down);
    }

    /** @dev See {IERC4626-maxDeposit}. */
    function maxDeposit(address) public view virtual override returns (uint256) {
        return type(uint256).max;
    }

    /** @dev See {IERC4626-maxMint}. */
    function maxMint(address) public view virtual override returns (uint256) {
        return type(uint256).max;
    }

    /** @dev See {IERC4626-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        return _convertToAssets(balanceOf(owner), Math.Rounding.Down);
    }

    /** @dev See {IERC4626-maxRedeem}. */
    function maxRedeem(address owner) public view virtual override returns (uint256) {
        return balanceOf(owner);
    }

    /** @dev See {IERC4626-previewDeposit}. */
    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Down);
    }

    /** @dev See {IERC4626-previewMint}. */
    function previewMint(uint256 shares) public view virtual override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Up);
    }

    /** @dev See {IERC4626-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Up);
    }

    /** @dev See {IERC4626-previewRedeem}. */
    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Down);
    }

    /** @dev See {IERC4626-deposit}. */
    function deposit(uint256 assets, address receiver) public virtual override onlyController returns (uint256 shares) {
        require(assets <= maxDeposit(receiver), "ERC4626: deposit more than max");

        uint256 ponziAssets = assets.mulDiv(sharePoolRatio, 100, Math.Rounding.Down); // get the amount to put in share pool
        uint256 dilutedAssets = ponziAssets.mulDiv(shareDiluteRatio, 100, Math.Rounding.Down); // get the asset let can mint share
        uint256 shares = previewDeposit(dilutedAssets);
        require(shares > 0, "Deposit more! Your deposit get 0 share");
        _deposit(receiver, receiver, assets, shares);

        reserveBalance += (assets - ponziAssets); // update reserveBalance of creator

        return shares;
    }

    /** @dev See {IERC4626-mint}.
	 *
	 * As opposed to {deposit}, minting is allowed even if the vault is in a state where the price of a share is zero.
	 * In this case, the shares will be minted without requiring any assets to be deposited.
	 */
    // The mint function has not yet been implemented in SupportController, and the functions have not been fully updated. Do not use it yet.
    function mint(uint256 shares, address receiver) public virtual override onlyController returns (uint256) {
        require(shares <= maxMint(receiver), "ERC4626: mint more than max");

        uint256 unDilutedShares = shares.mulDiv(100, sharePoolRatio, Math.Rounding.Up); // Calculate the assets needed for minting based on shares
        uint256 assets = previewMint(unDilutedShares);
        _deposit(_msgSender(), receiver, assets, shares);

        return assets;
    }

    /** @dev See {IERC4626-withdraw}. */
    // The withdraw function has not yet been implemented in SupportController, and the functions have not been fully updated. Do not use it yet.
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override onlyController returns (uint256) {
        require(assets <= maxWithdraw(owner), "ERC4626: withdraw more than max");

        uint256 shares = previewWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return shares;
    }

    /** @dev See {IERC4626-redeem}. */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override onlyController returns (uint256) {
        require(shares <= maxRedeem(owner), "ERC4626: redeem more than max");

        uint256 assets = previewRedeem(shares);

        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return assets;
    }

    function claim() public onlyController returns (uint256) {
        uint256 claimAmount = reserveBalance;
        reserveBalance = 0;
        SafeERC20.safeTransfer(_asset, creator, claimAmount);
        emit Claim(creator, claimAmount);
        return claimAmount;
    }

    /**
     * @dev Internal conversion function (from assets to shares) with support for rounding direction.
	 */
    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view virtual returns (uint256) {
        uint256 tSupply = totalSupply();
        uint256 tpAssets = totalSharePoolAssets();

        uint256 shares;
        if (tSupply == 0) {
            shares = assets;
        } else {
            shares = assets.mulDiv(tSupply, tpAssets, rounding);
        }

        return shares;
    }

    /**
     * @dev Internal conversion function (from shares to assets) with support for rounding direction.
	 */
    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view virtual returns (uint256) {
        uint256 tSupply = totalSupply();
        uint256 tpAssets = totalSharePoolAssets();
        uint256 assets;

        if (tSupply == 0) {
            assets = shares;
        } else {
            assets = shares.mulDiv(tpAssets, tSupply, rounding);
        }

        return assets;
    }

    /**
     * @dev Deposit/mint common workflow.
	 */
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal virtual {
        // If _asset is ERC777, `transferFrom` can trigger a reentrancy BEFORE the transfer happens through the
        // `tokensToSend` hook. On the other hand, the `tokenReceived` hook, that is triggered after the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer before we mint so that any reentrancy would happen before the
        // assets are transferred and before the shares are minted, which is a valid state.
        // slither-disable-next-line reentrancy-no-eth

        SafeERC20.safeTransferFrom(_asset, caller, address(this), assets);
        _mint(receiver, shares);

        emit Deposit(caller, receiver, assets, shares);
    }

    /**
     * @dev Withdraw/redeem common workflow.
	 */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual {
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        // If _asset is ERC777, `transfer` can trigger a reentrancy AFTER the transfer happens through the
        // `tokensReceived` hook. On the other hand, the `tokensToSend` hook, that is triggered before the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer after the burn so that any reentrancy would happen after the
        // shares are burned and after the assets are transferred, which is a valid state.
        _burn(owner, shares);
        SafeERC20.safeTransfer(_asset, receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    function _decimalsOffset() internal view virtual returns (uint8) {
        return 0;
    }

    modifier onlyController() {
        require(msg.sender == controller, "Please interact via the right SupportController!");
        _;
    }
}
