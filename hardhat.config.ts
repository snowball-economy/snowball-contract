import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';

import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-deploy-tenderly';

import {accounts, addForkConfiguration, node_url} from './utils/network';

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: '0.8.17',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 2000,
                    },
                },
            },
        ],
    },
    namedAccounts: {
        deployer: 0,
        simpleERC20Beneficiary: 1,
    },
    networks: addForkConfiguration({
        hardhat: {
            initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
        },
        localhost: {
            url: node_url('localhost'),
            accounts: accounts(),
        },
        staging: {
            url: node_url('rinkeby'),
            accounts: accounts('rinkeby'),
        },
        production: {
            url: node_url('mainnet'),
            accounts: accounts('mainnet'),
        },
        mainnet: {
            url: node_url('mainnet'),
            accounts: accounts('mainnet'),
        },
        mumbai: {
            url: node_url('mumbai'),
            accounts: accounts('mumbai'),
            gasPrice: 40000000000, // 20 Gwei
            verify: {
                etherscan: {
                    // Your API key for Etherscan
                    apiKey: process.env.POLYGON_SCAN_API_KEY,
                    apiUrl: 'https://api-testnet.polygonscan.com/',
                },
            },
        },
        fuji: {
            url: 'https://api.avax-test.network/ext/bc/C/rpc', // RPC URL for Fuji testnet
            accounts: [process.env.PRIVATE_KEY],
            gasPrice: 225000000000, // Adjust the gas price as needed
            chainId: 43113, // Chain ID for Fuji
            // You can also add other configurations like block confirmations, etc.
        },
        // pego: {
        //     url: node_url('pego'),
        //     accounts: accounts('pego'),
        //     gasPrice: 2000000000000, // 20 Gwei
        //     verify: {
        //         etherscan: {
        //             // Your API key for Etherscan
        //             apiUrl: 'https://scan.pego.network',
        //         },
        //     },
        // },
    }),
    paths: {
        sources: 'src',
    },
    gasReporter: {
        currency: 'USD',
        gasPrice: 100,
        enabled: process.env.REPORT_GAS ? true : false,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        maxMethodDiff: 10,
    },
    mocha: {
        timeout: 0,
    },
    external: process.env.HARDHAT_FORK
        ? {
            deployments: {
                // process.env.HARDHAT_FORK will specify the network that the fork is made from.
                // these lines allow it to fetch the deployments from the network being forked from both for node and deploy task
                hardhat: ['deployments/' + process.env.HARDHAT_FORK],
                localhost: ['deployments/' + process.env.HARDHAT_FORK],
            },
        }
        : undefined,

    tenderly: {
        project: 'template-ethereum-contracts',
        username: process.env.TENDERLY_USERNAME as string,
    },
};

export default config;
