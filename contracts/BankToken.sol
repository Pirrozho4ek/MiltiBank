// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Simple ERC20 token for MultiBank contract testing

contract BankToken is ERC20 {
    constructor() ERC20("BankTooken", "BT") {
        _mint(msg.sender, 100000 * 10 ** decimals());
    }
}