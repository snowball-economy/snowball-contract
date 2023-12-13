import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const contractName = 'TUSDT';
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy} = deployments;

	console.log('======================================================');
	const {deployer} = await getNamedAccounts();
	console.log('start deploy contract:', contractName);
	await deploy(contractName, {
		from: deployer,
		args: [],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
		// gasPrice: 'auto', // gasPrice: "auto
		// gasLimit: 10000,
	});
	const {address: contractAddress} = await deployments.get(contractName);
	console.log('contractAddress: ', contractAddress);
	console.log('end deploy contract:', contractName);
	console.log('end deploy contract:', contractName);
	console.log('======================================================');
};
export default func;
func.tags = [contractName];
