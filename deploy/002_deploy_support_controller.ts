import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const contractName = 'SupportController';
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;

	const { deployer } = await getNamedAccounts();
	// get ERC20 token address
	const { address: denominatedTokenAddress } = await deployments.get('TUSDT');
	console.log('======================================================');

	console.log('start deploy contract:', contractName);
	console.log('denominatedTokenAddress: ', denominatedTokenAddress);

	await deploy('SupportController', {
		from: deployer,
		// args: ["Zengineer Supporter", "ZS", denominatedTokenAddress],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
	});
	// get contract address
	const { address: contractAddress } = await deployments.get(contractName);
	console.log('contractAddress: ', contractAddress);
	console.log('end deploy contract:', contractName);
	console.log('======================================================');
};
export default func;
func.tags = [contractName];
// depender on SimpleERC20
func.dependencies = ['TUSDT'];
