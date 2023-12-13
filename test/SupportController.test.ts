import {deployments, ethers, getNamedAccounts, getUnnamedAccounts} from 'hardhat';
import {IERC20, SupportController, Vault} from '../typechain-types';
import {setupUser, setupUsers} from './utils';
import {expect} from "chai";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";

const setup = deployments.createFixture(async () => {
    await deployments.fixture('SupportController');
    const {deployer} = await getNamedAccounts();
    const {simpleERC20Beneficiary} = await getNamedAccounts();

    const contracts = {
        SimpleERC20: <IERC20>await ethers.getContract('SimpleERC20'),
        SupportController: <SupportController>await ethers.getContract('SupportController'),
    };

    const users = await setupUsers(await getUnnamedAccounts(), contracts);
    return {
        ...contracts,
        users,
        deployer: await setupUser(deployer, contracts),
        simpleERC20Beneficiary: await setupUser(simpleERC20Beneficiary, contracts),
    };
});

describe('SupportController', function () {

    async function createVaultFixture() {
        const {
            users,
            SimpleERC20,
            SupportController,
            deployer
        } = await setup();

        await users[1].SupportController.createVault(
            SimpleERC20.getAddress(),
            'TestVault',
            'TV',
            90,
            90
        );


        const vaultAddress = await SupportController.allVaults(users[1].address, 0);
        return {vaultAddress};
    }

    it('create Vault', async function () {
        // setup
        const {
            users,
            SimpleERC20,
            SupportController,
            deployer
        } = await setup();

        const testVaultName = 'TestVault';
        const testVaultSymbol = 'TV';
        const testSharePoolRatio = 90;
        const testShareDiluteRatio = 90;

        // can use createVault function to create vault
        // emit `NewVault` with proper args
        await expect(
            users[1].SupportController.createVault(
                SimpleERC20.getAddress(),
                testVaultName,
                testVaultSymbol,
                testSharePoolRatio,
                testShareDiluteRatio
            )
        ).to.emit(SupportController, 'NewVault');
        // vault create correctly
        // - the controller of vault is support controller
        const vaultAddress = await SupportController.allVaults(users[1].address, 0);
        const Vault = await ethers.getContractAt('Vault', vaultAddress);
        await expect(
            await Vault.getController()
        ).to.equal(await SupportController.getAddress());

        // - the creator of vault is the function caller
        await expect(
            await Vault.creator()
        ).to.equal(users[1].address);
    });


// deposit
    it('user cannot direct deposit to Vault', async function () {
        const {users, SimpleERC20, SupportController, deployer} = await setup();
        const {vaultAddress} = await loadFixture(createVaultFixture);

        const Vault = await ethers.getContractAt('Vault', vaultAddress);
        await expect(
            Vault.deposit(
                10000000,
                users[1].address
            )
        ).to.be.revertedWith('Please interact via the right SupportController!');
    });
    // user can deposit
    it('use support controller to deposit', async function () {
        const {users, SimpleERC20, SupportController, deployer, simpleERC20Beneficiary} = await setup();
        const {vaultAddress} = await loadFixture(createVaultFixture);
        const Vault = await ethers.getContractAt('Vault', vaultAddress);


        // deposit function success
        // - transfer token to users[1]
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[1].address, 10000000000000);
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[2].address, 10000000000000);
        // - assert balance of users[1]
        // authorized by support controller
        await users[1].SimpleERC20.approve(vaultAddress, 10000000000000);
        await users[2].SimpleERC20.approve(vaultAddress, 10000000000000);
        // - deposit to support controller
        await expect(
            users[1].SupportController.deposit(
                vaultAddress,
                10000000,
                users[1].address
            )
        )
            .to.changeTokenBalances(SimpleERC20, [users[1].address, vaultAddress], [-10000000, 10000000])


        await expect(
            users[2].SupportController.deposit(
                vaultAddress,
                10000000,
                users[2].address
            )
        ).to.emit(SupportController, 'Deposit')

        // - check the share pool
        await expect(
            await Vault.totalSharePoolAssets()
        ).to.equal(18000000);

        // share balance
        // - get total share supply
        const totalShareSupply = await Vault.totalSupply();
        console.log('totalShareSupply', totalShareSupply.toString());

        // - get share balance of users[1]
        const shareBalanceOfUser1 = await Vault.balanceOf(users[1].address);
        console.log('shareBalanceOfUser1', shareBalanceOfUser1.toString());

        // - get share balance of users[2]
        const shareBalanceOfUser2 = await Vault.balanceOf(users[2].address);
        console.log('shareBalanceOfUser2', shareBalanceOfUser2.toString());

        // - assert share balance of users[2] is 0.9 * (share balance of users[1])
        expect(shareBalanceOfUser2.toString()).to.equal(
            (
                BigInt(9) * shareBalanceOfUser1 / BigInt(10)
            )
        );

    });


    // user can redeem
    it('can\'t withdraw by non-controller account', async function () {
        const {users, SimpleERC20, SupportController, deployer, simpleERC20Beneficiary} = await setup();
        const {vaultAddress} = await loadFixture(createVaultFixture);
        const Vault = await ethers.getContractAt('Vault', vaultAddress);
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[1].address, 10000000000000);
        await users[1].SimpleERC20.approve(vaultAddress, 10000000000000);
        await users[1].SupportController.deposit(
            vaultAddress,
            10000000,
            users[1].address
        )

        await expect(
            Vault.redeem(
                10000000,
                users[1].address,
                users[1].address
            )
        ).to.be.revertedWith('Please interact via the right SupportController!');
    });

    it('user use support controller to withdraw', async function () {
        const {users, SimpleERC20, SupportController, deployer, simpleERC20Beneficiary} = await setup();
        const {vaultAddress} = await loadFixture(createVaultFixture);
        const Vault = <Vault><unknown>await ethers.getContractAt('Vault', vaultAddress);
        // deposit function success
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[1].address, 10000000);
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[2].address, 10000000);
        await users[1].SimpleERC20.approve(vaultAddress, 10000000);
        await users[2].SimpleERC20.approve(vaultAddress, 10000000);
        await users[1].SupportController.deposit(
            vaultAddress,
            10000000,
            users[1].address
        )
        await users[2].SupportController.deposit(
            vaultAddress,
            10000000,
            users[2].address
        )
        const shareBalanceOfUser1 = await Vault.balanceOf(users[1].address);
        const shareBalanceOfUser2 = await Vault.balanceOf(users[2].address);

        // approve support controller to use user's Vault token
        await Vault.connect(
            await ethers.getSigner(users[1].address)
        ).approve(SupportController.getAddress(), shareBalanceOfUser1);
        await Vault.connect(
            await ethers.getSigner(users[2].address)
        ).approve(SupportController.getAddress(), shareBalanceOfUser1);


        // redeem function
        await expect(
            users[1].SupportController.redeem(
                vaultAddress,
                shareBalanceOfUser1,
                users[1].address,
                users[1].address
            )
        ).to.emit(SupportController, 'Redeem')
        await expect(
            users[2].SupportController.redeem(
                vaultAddress,
                shareBalanceOfUser2,
                users[2].address,
                users[2].address
            )
        ).to.emit(SupportController, 'Redeem')

        // check the share pool need to be zero
        console.log('user 1 sharePoolAssets', await Vault.balanceOf(users[1].address));
        expect(await Vault.balanceOf(users[1].address)).to.equal(0);
        expect(await Vault.balanceOf(users[2].address)).to.equal(0);

        // log balance of user[1]
        const user1TokenBalance = await SimpleERC20.balanceOf(users[1].address);
        const user2TokenBalance = await SimpleERC20.balanceOf(users[2].address);

        console.log("user 1 token balance", user1TokenBalance);
        // log balance of user[2]
        console.log("user 2 token balance", user2TokenBalance);

        const tolerance = 10; // Or whatever value is acceptable
        expect(Math.abs(Number(user2TokenBalance - BigInt(9) * user1TokenBalance / BigInt(10))) <= tolerance).to.be.true;

    });
    // creator can claim
    it('non creator can\'t claim', async function () {
        const {users, SimpleERC20, SupportController, deployer, simpleERC20Beneficiary} = await setup();
        const {vaultAddress} = await loadFixture(createVaultFixture);
        const Vault = <Vault><unknown>await ethers.getContractAt('Vault', vaultAddress);
        // deposit function success
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[1].address, 10000000);
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[2].address, 10000000);
        await users[1].SimpleERC20.approve(vaultAddress, 10000000);
        await users[2].SimpleERC20.approve(vaultAddress, 10000000);
        await users[1].SupportController.deposit(
            vaultAddress,
            10000000,
            users[1].address
        )
        await users[2].SupportController.deposit(
            vaultAddress,
            10000000,
            users[2].address
        )

        // users[2] claim
        await expect(
            users[2].SupportController.claim(
                vaultAddress,
            )
        ).to.be.revertedWith('Dont fuck with others assets! bro');
    });

    it('creator can claim', async function () {
        const {users, SimpleERC20, SupportController, deployer, simpleERC20Beneficiary} = await setup();
        const {vaultAddress} = await loadFixture(createVaultFixture);
        const Vault = <Vault><unknown>await ethers.getContractAt('Vault', vaultAddress);
        // deposit function success
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[1].address, 10000000);
        await simpleERC20Beneficiary.SimpleERC20.transfer(users[2].address, 10000000);
        await users[1].SimpleERC20.approve(vaultAddress, 10000000);
        await users[2].SimpleERC20.approve(vaultAddress, 10000000);
        await users[1].SupportController.deposit(
            vaultAddress,
            10000000,
            users[1].address
        )
        await users[2].SupportController.deposit(
            vaultAddress,
            10000000,
            users[2].address
        )

        // calculate how much can creator claim
        const calculatedReserveBalance = 10000000 * 2 * 0.1;

        const actualReserveBalance = await Vault.reserveBalance();
        expect(Number(actualReserveBalance)).to.equal(calculatedReserveBalance);

        // redeem
        await expect(
            users[1].SupportController.claim(
                vaultAddress,
            )
        ).to.emit(SupportController, 'Claim')

        // check reserve to be 0
        expect(await Vault.reserveBalance()).to.equal(0);


    });

});
