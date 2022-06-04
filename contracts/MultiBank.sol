// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MultiBank is Ownable, ERC1155 {

    mapping(address => bool) public authorized;
    address[] private authorized_array;

    address public faucetAddress;
    uint256 public faucetAmount; 

    uint256 public constant DEBET = 0;
    uint256 public constant CREDIT = 1;

    IERC20 bankToken;
    event TransferSent(address _from, address _destAddress, uint256 _amount);

    modifier onlyAuthorized() {
        require(authorized[msg.sender] || owner() == msg.sender,"not Authorized!");
        _;
    }

    modifier isAuthorized(address caller) {
        require(authorized[caller],"is not Authorized!");
        _;
    }

    modifier onlyFaucet() {
        require(msg.sender == faucetAddress,"wrong faucet caller!");
        _;
    }

    constructor() Ownable() ERC1155("") {
        faucetAddress = msg.sender;
    }

    function setBankToken(address newTokenAddress) public onlyOwner {
        bankToken = IERC20( newTokenAddress );
    }

    function getBankTokenAddress() public view returns(address)  {
        return address(bankToken);
    }

    function currentBalance() public view returns(uint){
        if( address(bankToken) != address(0) ) {
            return bankToken.balanceOf(address(this));
        } else {
            return 0;
        }
        
    }

    function removeAuthorizedArrayElement(address addr) internal {
        bool addr_found;
        for (uint i = 0; i<authorized_array.length-1; i++){
            if( !addr_found ) {
                addr_found = authorized_array[i] == addr;
            }

            if( addr_found ) {
                authorized_array[i] = authorized_array[i+1];
            } 
        }
        authorized_array.pop();
    }

    receive() external payable {
    }

    function addAuthorized(address _toAdd) onlyOwner public {
        require(_toAdd != address(0));
        require( !authorized[_toAdd] );
        authorized[_toAdd] = true;
        authorized_array.push(_toAdd);
    }

    function removeAuthorized(address _toRemove) onlyOwner public {
        require(_toRemove != address(0));
        require(_toRemove != msg.sender);
        authorized[_toRemove] = false;
        removeAuthorizedArrayElement(_toRemove);
    }

    function getAddressAuthorized(address addr) public view returns(bool) {
        return authorized[addr];
    }

    function getAddressAuthorizedArray() public view returns(address[] memory ) {
        return authorized_array;
    }

    function setFaucetAddress(address addr) external onlyOwner() {
        faucetAddress = addr;
    }
    
    function setFaucetAmount(uint256 amount) external onlyOwner()  {
        faucetAmount = amount;
    }

    function faucet(address payable _to) external onlyFaucet() isAuthorized(_to) {
        require(address(this).balance >= faucetAmount,"not enough balance!");
        _to.transfer(faucetAmount);
    }

    function claim(uint256 amount) public onlyAuthorized(){
        transferERC20( bankToken, address(this), msg.sender, amount);
        uint debetBalance = this.balanceOf(msg.sender, DEBET);
        if(debetBalance > 0) {
            if(debetBalance >= amount) {
                _burn(msg.sender, DEBET, amount);
            } else {
                _mint(msg.sender, CREDIT, (amount - debetBalance), "");
                _burn(msg.sender, DEBET, debetBalance);
            }
        } else {
            _mint(msg.sender, CREDIT, amount, "");
        }
    }

    function deposit(uint256 amount) public onlyAuthorized() {
        transferERC20( bankToken, msg.sender, address(this), amount);
        uint creditBalance = this.balanceOf(msg.sender, CREDIT);
        if(creditBalance >= 0) {
            if(creditBalance > amount) {
                _burn(msg.sender, CREDIT, amount);
            } else {
                _mint(msg.sender, DEBET, (amount - creditBalance), "");
                _burn(msg.sender, CREDIT, creditBalance);
            }
        } else {
            _mint(msg.sender, DEBET, amount, "");
        }
    }


    function transferERC20( IERC20 token, address from, address to, uint256 amount) public onlyAuthorized {
        uint256 erc20balance = token.balanceOf(from);
        require(amount <= erc20balance, "balance is low");
        if( from  == address(this) ) {
            token.transfer(to, amount);
        } else {
            token.transferFrom(from, to, amount);
        }
        
        emit TransferSent(from, to, amount);
    }
}