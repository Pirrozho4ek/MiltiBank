// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MultiBank is Ownable, ERC1155 {

    mapping(address => bool) public authorized;
    address[] private _authorizedArray;

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

    modifier isAuthorized(address _caller) {
        require(authorized[_caller],"is not Authorized!");
        _;
    }

    modifier onlyFaucet() {
        require(msg.sender == faucetAddress,"wrong faucet caller!");
        _;
    }

    constructor() Ownable() ERC1155("") {
        faucetAddress = msg.sender;
    }

    function setBankToken(address _newTokenAddress) public onlyOwner {
        bankToken = IERC20( _newTokenAddress );
    }

    function getBankTokenAddress() public view returns(address)  {
        return address(bankToken);
    }

    function currentBalance() public view returns(uint){
        if( address(bankToken) == address(0) ) {
            return 0;   
        }
        
        return bankToken.balanceOf(address(this));
    }

    function removeAuthorizedArrayElement(address _addr) internal {
        bool addrFound;
        for (uint i = 0; i<_authorizedArray.length-1; i++){
            if( !addrFound ) {
                addrFound = _authorizedArray[i] == _addr;
            }

            if( addrFound ) {
                _authorizedArray[i] = _authorizedArray[i+1];
            } 
        }
        _authorizedArray.pop();
    }

    receive() external payable {
    }

    function addAuthorized(address _toAdd) onlyOwner public {
        require(_toAdd != address(0));
        require( !authorized[_toAdd] );
        authorized[_toAdd] = true;
        _authorizedArray.push(_toAdd);
    }

    function removeAuthorized(address _toRemove) onlyOwner public {
        require(_toRemove != address(0));
        require(_toRemove != msg.sender);
        authorized[_toRemove] = false;
        removeAuthorizedArrayElement(_toRemove);
    }

    function getAddressAuthorized(address _addr) public view returns(bool) {
        return authorized[_addr];
    }

    function getAddressAuthorizedArray() public view returns(address[] memory ) {
        return _authorizedArray;
    }

    function setFaucetAddress(address _addr) external onlyOwner() {
        faucetAddress = _addr;
    }
    
    function setFaucetAmount(uint256 _amount) external onlyOwner()  {
        faucetAmount = _amount;
    }

    function faucet(address payable _to) external onlyFaucet() isAuthorized(_to) {
        require(address(this).balance >= faucetAmount,"not enough balance!");
        _to.transfer(faucetAmount);
    }

    function claim(uint256 _amount) public onlyAuthorized(){
        _transferERC20( bankToken, address(this), msg.sender, _amount);
        uint debetBalance = this.balanceOf(msg.sender, DEBET);
        if(debetBalance > 0) {
            if(debetBalance >= _amount) {
                _burn(msg.sender, DEBET, _amount);
            } else {
                _mint(msg.sender, CREDIT, (_amount - debetBalance), "");
                _burn(msg.sender, DEBET, debetBalance);
            }
        } else {
            _mint(msg.sender, CREDIT, _amount, "");
        }
    }

    function deposit(uint256 _amount) public onlyAuthorized() {
        _transferERC20( bankToken, msg.sender, address(this), _amount);
        uint creditBalance = this.balanceOf(msg.sender, CREDIT);
        if(creditBalance >= 0) {
            if(creditBalance > _amount) {
                _burn(msg.sender, CREDIT, _amount);
            } else {
                _mint(msg.sender, DEBET, (_amount - creditBalance), "");
                _burn(msg.sender, CREDIT, creditBalance);
            }
        } else {
            _mint(msg.sender, DEBET, _amount, "");
        }
    }


    function _transferERC20( IERC20 _token, address _from, address _to, uint256 _amount) private onlyAuthorized {
        uint256 erc20balance = _token.balanceOf(_from);
        require(_amount <= erc20balance, "balance is low");
        if( _from  == address(this) ) {
            _token.transfer(_to, _amount);
        } else {
            _token.transferFrom(_from, _to, _amount);
        }
        
        emit TransferSent(_from, _to, _amount);
    }
}