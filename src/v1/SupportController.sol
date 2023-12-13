// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./Vault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract SupportController {
    mapping(address => address[]) public allVaults;
    uint private unlimited = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    // event definition
    event NewVault(
        address indexed creator,
        address indexed assets,
        string name,
        string symbol,
        uint8 sharePoolRatio,
        uint8 shareDiluteRatio,
        address vaultAddress
    );

    event Deposit(
        address indexed vaultAddress,
        address indexed depositor,
        address indexed receiver,
        uint256 depositAmount,
        uint256 getShareAmount
    );

    event Redeem(
        address indexed vaultAddress,
        address indexed redeemor,
        address indexed receiver,
        uint256 redeemShareAmount,
        uint256 getAssetAmount
    );

    event Claim(
        address indexed vaultAddress,
        uint256 amount
    );

    function createVault(
        address asset_,
        string memory name_,
        string memory symbol_,
        uint8 sharePoolRatio_,
        uint8 shareDiluteRatio_
    ) external returns (address vaultAddress) {
        // create vault contract
        Vault vault = new Vault(msg.sender, asset_, name_, symbol_, sharePoolRatio_, shareDiluteRatio_);

        // update map
        vaultAddress = address(vault);
        allVaults[msg.sender].push(vaultAddress);

        // controller authorize all asset to Vault Contract
        //        bool result = asset_.approve(vaultAddress, unlimited);
        emit NewVault(msg.sender, asset_, name_, symbol_, sharePoolRatio_, shareDiluteRatio_, vaultAddress);
    }

    function deposit(address vaultAddress, uint256 assets, address receiver) public returns (uint256 getShareAmount) {
        // user transfer asset to controller
        Vault vault = Vault(vaultAddress);
//        SafeERC20.safeTransferFrom(ERC20(vault.asset()), msg.sender, address(this), assets);

        // controller call deposit asset
        getShareAmount = vault.deposit(assets, receiver);

        emit Deposit(vaultAddress, msg.sender, receiver, assets, getShareAmount);
    }

    function redeem(
        address vaultAddress,
        uint256 shares,
        address receiver,
        address owner
    ) public returns (uint256 getAssetAmount) {

        getAssetAmount = Vault(vaultAddress).redeem(shares, receiver, owner);

        emit Redeem(vaultAddress, owner, receiver, shares, getAssetAmount);
    }

    function claim(address vaultAddress) public {
        require(msg.sender == Vault(vaultAddress).creator(), "Dont fuck with others assets! bro");
        uint256 claimAmount = Vault(vaultAddress).claim();
        emit Claim(vaultAddress, claimAmount);
    }

    function claimAll() public {
        for (uint8 i = 0; i < allVaults[msg.sender].length; i++) {
            address vaultAddress = allVaults[msg.sender][i];
            uint256 claimAmount = Vault(vaultAddress).claim();
            emit Claim(vaultAddress, claimAmount);
        }
    }
}
