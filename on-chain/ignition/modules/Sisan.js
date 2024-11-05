const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("SisanModule", (m) => {
  const sisan = m.contract("Sisan");

  return { sisan };
});
