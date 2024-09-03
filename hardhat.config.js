require("@nomicfoundation/hardhat-toolbox");
require("fhenix-hardhat-plugin");
require("fhenix-hardhat-docker");

const fs = require('fs');
const [_, privateKey] = fs.readFileSync(".env").toString().trim().split("=");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "localfhenix",
  networks: {
    hardhat: {
      chainId: 1337
    },
    localFhenix: {
      url: `127.0.0.1:42069`,
    },
    fhenixHeliumTestnet: {
      url: `https://api.helium.fhenix.zone`,
      chainId: 8008135,
      accounts: [privateKey]
    },
  },
  solidity: "0.8.24",
};
