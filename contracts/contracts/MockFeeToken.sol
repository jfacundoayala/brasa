// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice SOLO PARA TESTS. Token de 6 decimales que se queda con el 1% de cada transferencia
///         ("fee-on-transfer"). Sirve para probar que BrasaFund acredita lo recibido y no lo pedido.
///         Nunca se despliega: deploy.mjs no lo usa.
contract MockFeeToken is ERC20 {
    constructor() ERC20("Mock Fee Token", "FEE") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) return super._update(from, to, value);
        uint256 cut = value / 100;
        super._update(from, address(0xdead), cut);
        super._update(from, to, value - cut);
    }
}
