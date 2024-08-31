const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const owner = "0xd32a1F1ddc675a6a07b95DDBBD063593f5E96702";

module.exports = buildModule("SisanModule", (m) => {
  const sisan = m.contract("Sisan", [owner]);

  return { sisan };
});
