import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
    settings: { evmVersion: "cancun", viaIR: true, optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    fuji: {
      type: "http",
      chainType: "l1",
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      // La clave se guarda en el keystore de Hardhat: npx hardhat keystore set FUJI_PRIVATE_KEY
      accounts: [configVariable("FUJI_PRIVATE_KEY")],
    },
  },
});
