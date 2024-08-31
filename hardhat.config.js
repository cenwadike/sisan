require("@nomicfoundation/hardhat-toolbox");

const fs = require('fs');
const [_, privateKey] = fs.readFileSync(".env").toString().trim().split("=");

console.log(privateKey)

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337
    },
    fhenixHeliumTestnet: {
      url: `https://api.helium.fhenix.zone`,
      accounts: [privateKey]
    },
  },
  solidity: "0.8.24",
};
