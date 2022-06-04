const { expect } = require("chai");
const { ethers } = require("hardhat");
//const { UnicodeNormalizationForm } = require("ethers/lib/utils");

describe("Multibank", function () {
  let accOwner;
  let accAuthorized;
  let accGuest;
  let accGuestToBeAuth;

  let multiBank;
  let bankToken;

  const debetTokenID = 0;
  const creditTokenID = 1;

  async function InitContracts() {
    [accOwner, accAuthorized, accGuest, accGuestToBeAuth] = await ethers.getSigners();
    const MultiBank = await ethers.getContractFactory("MultiBank", accOwner);
    multiBank = await MultiBank.deploy();
    await multiBank.deployed();

    const BankToken = await ethers.getContractFactory("BankToken", accOwner);
    bankToken = await BankToken.deploy();
    await bankToken.deployed();

    const tx = await multiBank.setBankToken(bankToken.address);
    await tx.wait();
  }

  async function AddAuthorizedAcc( account ) { 
    const tx = await multiBank.connect(accOwner).addAuthorized( account.address );
    await tx.wait();
  }

  describe("Basic", async function () {
    beforeEach(async function() {
      await InitContracts();
    });

    it("Success multiBank deployed", async function () {
      expect(multiBank.address).to.be.properAddress;
    });

    it("Success bankToken deployed", async function () {
      expect(bankToken.address).to.be.properAddress;
    })

    it("Success Recieve from guest", async function() {
      const valueToSend = ethers.utils.parseEther("1.0");
      const contractBalanceBefore = await ethers.provider.getBalance(multiBank.address);

      const tx = await accGuest.sendTransaction({
        to: multiBank.address,
        value: valueToSend,
          });
      tx.wait();

      const contractBalanceAfter = await ethers.provider.getBalance(multiBank.address);
      expect(contractBalanceAfter).to.eq( contractBalanceBefore + valueToSend );
    });
  });

  describe("Set Autorization", function () {

    beforeEach(async function() {
      await InitContracts();
    });

    it("Failed by Guest user", async function() {
      await expect(
        multiBank.connect(accGuest).addAuthorized(accGuest.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Failed by Authorized user", async function() {
      await AddAuthorizedAcc(accAuthorized);
      await expect(
        multiBank.connect(accAuthorized).addAuthorized(accGuest.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success by Owner", async function() {
      await AddAuthorizedAcc(accGuestToBeAuth);

      expect( await multiBank.getAddressAuthorized(accGuestToBeAuth.address) ).to.equal(true);

      const authorized_array_after = await multiBank.getAddressAuthorizedArray()
      expect( authorized_array_after ).to.be.an('array').that.includes( accGuestToBeAuth.address );
      expect( authorized_array_after ).to.have.lengthOf(1);
    });

  });

  describe("Set BankToken", function () {
    beforeEach(async function() {
      await InitContracts();
    });
  
    it("Failed by Guest", async function() {
      await expect(
        multiBank.connect(accAuthorized).setBankToken(bankToken.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Failed by Authorized user", async function() {
      await expect(
        multiBank.connect(accAuthorized).setBankToken(bankToken.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success by Owner", async function() {

      const BankToken = await ethers.getContractFactory("BankToken", accOwner);
      const newBankToken = await BankToken.deploy();
      await newBankToken.deployed();
  
      const tx = await multiBank.setBankToken(newBankToken.address);
      await tx.wait();
  
      const bankTokenAddress = await multiBank.getBankTokenAddress();
      expect(bankTokenAddress).to.equal(newBankToken.address);
    });
  });

  

  describe("Remove Autorization", function () {

    beforeEach(async function() {
      await InitContracts();
      await AddAuthorizedAcc(accAuthorized);
    });

    it("Failed by Guest", async function() {
      expect( await multiBank.getAddressAuthorized(accAuthorized.address) ).to.equal(true);

      await expect(
        multiBank.connect(accGuest).removeAuthorized(accAuthorized.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Failed by Authorized address", async function() {
      expect( await multiBank.getAddressAuthorized(accAuthorized.address) ).to.equal(true);

      await expect(
        multiBank.connect(accAuthorized).removeAuthorized(accAuthorized.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success by Owner", async function() {
      expect( await multiBank.getAddressAuthorized(accAuthorized.address) ).to.equal(true);

      const authorized_array_before = await multiBank.getAddressAuthorizedArray()
      expect( authorized_array_before).to.be.an('array');
      expect( authorized_array_before).to.have.lengthOf(1);
      expect( authorized_array_before).to.eql([accAuthorized.address])

      const tx1 = await multiBank.connect(accOwner).removeAuthorized(accAuthorized.address);
      await tx1.wait();

      expect( await multiBank.getAddressAuthorized(accAuthorized.address) ).to.equal(false);

      const authorized_array_after = await multiBank.getAddressAuthorizedArray()
      expect( authorized_array_after).to.be.an('array');
      expect( authorized_array_after).to.have.lengthOf(0);
    });
    
  });

  describe("Set faucet address", function () {

    beforeEach(async function() {
      await InitContracts();
      await AddAuthorizedAcc(accAuthorized);
    });

    it("Failed by Guest", async function() {
      await expect(
        multiBank.connect(accGuest).setFaucetAddress(accGuest.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Failed by Authorized user", async function() {
      await expect(
        multiBank.connect(accAuthorized).setFaucetAddress(accGuest.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Success default by Owner", async function() {
      const fucetAddress = await multiBank.faucetAddress();
      expect(fucetAddress).to.eq(accOwner.address );
    });

    it("Success by changed faucet address", async function() {
      const tx = await multiBank.connect(accOwner).setFaucetAddress(accGuest.address);
      await tx.wait();

      const fucetAddress = await multiBank.faucetAddress();
      expect(fucetAddress).to.eq(accGuest.address );
    });

});

describe("Set faucet amount", function () {

  beforeEach(async function() {
    await InitContracts();
    await AddAuthorizedAcc(accAuthorized);
  });

  it("Failed by Guest", async function() {
    await expect(
      multiBank.connect(accGuest).setFaucetAmount( 10 )
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Failed by Authorized user", async function() {
    await expect(
      multiBank.connect(accAuthorized).setFaucetAmount( 10 )
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Success by Owner", async function() {
    const tx = await multiBank.connect(accOwner).setFaucetAmount( 10 );
    await tx.wait();

    const faucetAmount = await multiBank.faucetAmount();
    expect(faucetAmount).to.eq( 10 );
  });

});

describe("Faucet", function () {

  beforeEach(async function() {
    await InitContracts();
    await AddAuthorizedAcc(accAuthorized);
  });

  it("Failed by Guest", async function() {
    await expect(
      multiBank.connect(accGuest).faucet( accGuest.address )
    ).to.be.revertedWith("wrong faucet caller!");
  });

  it("Failed by Authorized user", async function() {
    await expect(
      multiBank.connect(accAuthorized).faucet( accGuest.address )
    ).to.be.revertedWith("wrong faucet caller!");
  });

  it("Failed to Guest", async function() {
    await expect(
      multiBank.connect(accOwner).faucet( accGuest.address )
    ).to.be.revertedWith("is not Authorized!");
  });

  it("Failed not enough balance", async function() {
    const faucetAmount = 10;

    const tx1 = await multiBank.connect(accOwner).setFaucetAmount( faucetAmount );
    await tx1.wait();

    await expect(
      multiBank.connect(accOwner).faucet( accAuthorized.address )
    ).to.be.revertedWith("not enough balance!");
  });

  
  it("Success by Owner to Authorized user", async function() {
    const faucetAmount = 10;

    const tx1 = await multiBank.connect(accOwner).setFaucetAmount( faucetAmount );
    await tx1.wait();

    const tx2 = await accGuest.sendTransaction({
      to: multiBank.address,
      value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
    })
    await tx2.wait();

    const contractBalanceBefore = await ethers.provider.getBalance(multiBank.address);

    await expect(() => multiBank.connect(accOwner).faucet(accAuthorized.address))
      .to.changeEtherBalance( accAuthorized, faucetAmount );

    const contractBalanceAfter = await ethers.provider.getBalance(multiBank.address);
  });

});
  


async function SetContractBalance( balance ) {
  const tx = await bankToken.connect(accOwner).transfer(multiBank.address, balance);
  await tx.wait();
};

async function SetAccountBalance( account, balance ) {
  const tx = await bankToken.connect(accOwner).transfer(account.address, balance);
  await tx.wait();
};

async function ClaimValue( account, value ) {
  const tx = await multiBank.connect(account).claim( value );
  await tx.wait();
}

async function DepositValue( account, value ) {
  const tx = await multiBank.connect(account).deposit(value);
  await tx.wait();
}

async function SetApproveToDeposit( account, value ) {  
  const tx = await bankToken.connect(account).approve( multiBank.address, value );
  await tx.wait();
};

async function ApproveAndDepositValue( account, value ) {
  await SetApproveToDeposit( account, value );
  await DepositValue( account, value );
}

  describe("Claim Simple", function () {

    const contractTokenBalanceDefult = 3000;

    beforeEach(async function(){
      await InitContracts();
      await SetContractBalance(contractTokenBalanceDefult);
      await AddAuthorizedAcc(accAuthorized);
    });

    it("Failed not enough balance on contract", async function() {
      await expect(
        multiBank.connect(accAuthorized).claim( contractTokenBalanceDefult + 100 )
      ).to.be.revertedWith("balance is low");
    });

    it("Failed by not Authorized user", async function() {
      await expect(
        multiBank.connect(accGuest).claim( 10 )
      ).to.be.revertedWith("not Authorized!");
    });

    it("Succes first time Claim with zero Debet", async function() {

      const value = 400;
      const balanceBefore = await multiBank.currentBalance();
      const accAuthorizedTokenBalanceBefore = await bankToken.balanceOf(accAuthorized.address);

      await ClaimValue( accAuthorized, value );

      const balanceAfter = await multiBank.currentBalance();
      expect(balanceAfter).to.eq( balanceBefore - value );

      const accAuthorizedBalance = await bankToken.balanceOf(accAuthorized.address);
      expect(accAuthorizedBalance).to.eq( accAuthorizedTokenBalanceBefore.toNumber() + value );
    });

  });

  describe("Deposit Simple", async function() {

    const initBalance = 3000;
    const accountInitBalance = 500
    const depositApproveValue = 200

    beforeEach(async function(){
      await InitContracts();
      await SetContractBalance( initBalance );
      await SetAccountBalance( accAuthorized, accountInitBalance  );
      await AddAuthorizedAcc( accAuthorized );
      await SetApproveToDeposit( accAuthorized, depositApproveValue );
    });

    it("Failed no allowance Deposit", async function() {
      let allowance = await bankToken.allowance(accAuthorized.address, multiBank.address);
      expect(allowance).to.not.equal(0);

      await expect(
        multiBank.connect(accAuthorized).deposit( allowance.toNumber() + 100 )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Failed no balance", async function(){
      const accBalance = await bankToken.balanceOf(accAuthorized.address);

      const valueToClaim = accBalance.toNumber() + 500

      await SetApproveToDeposit( accAuthorized, valueToClaim );

      await expect(
        multiBank.connect(accAuthorized).deposit( valueToClaim )
      ).to.be.revertedWith("balance is low")
    });

    it("Success first time Deposit with zero Credit", async function() {
      const depositValue = 200;

      const contractBalanceBefore = await multiBank.currentBalance();
      const accAuthorizedBalanceBefore = await bankToken.balanceOf(accAuthorized.address);

      const  debetBalanceBefore = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceBefore).to.eq(0);
      const creditBalanceBefore = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceBefore).to.eq(0);

      await ApproveAndDepositValue( accAuthorized, depositValue );

      const contractBalanceAfter = await multiBank.currentBalance();
      expect(contractBalanceAfter).to.eq( contractBalanceBefore.toNumber() + depositValue );

      const accAuthorizedBalanceAfter = await bankToken.balanceOf(accAuthorized.address);
      expect(accAuthorizedBalanceAfter).to.eq( accAuthorizedBalanceBefore.toNumber() - depositValue);

      const creditBalanceAfter = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceAfter).to.eq(0);
    });

  });


  describe("Deposit after Claim", async function() {
    const initBalance = 3000;
    const initAccountBalance = 1000

    beforeEach(async function(){
      await InitContracts();
      await SetContractBalance( initBalance );
      await SetAccountBalance( accAuthorized, initAccountBalance  );
      await AddAuthorizedAcc( accAuthorized );
      await SetApproveToDeposit( accAuthorized, initBalance + initAccountBalance);
    });

    it("Success same Deposit", async function() {

      const claimValue = 400;
      const depositValue = 400;

      const debetBalanceBefore = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceBefore).to.eq( 0 );

      const creditBalanceBefore = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceBefore).to.eq( 0 );

      await ClaimValue( accAuthorized, claimValue );
      await ApproveAndDepositValue( accAuthorized, depositValue );

      const debetBalanceAfter = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceAfter).to.eq( 0 );

      const creditBalanceAfter = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceAfter).to.eq( 0 );
    });

    it("Success less Deposit", async function() {

      const claimValue = 400;
      const depositValue = 200;

      const debetBalanceBefore = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceBefore).to.eq( 0 );

      const creditBalanceBefore = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceBefore).to.eq( 0 );

      await ClaimValue( accAuthorized, claimValue );
      await ApproveAndDepositValue( accAuthorized, depositValue );

      const debetBalanceAfter = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceAfter).to.eq( 0 );

      const creditBalanceAfter = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceAfter).to.eq( claimValue - depositValue );
    });

    it("Success bigger Deposit", async function() {

      const claimValue = 200;
      const depositValue = 400;

      const debetBalanceBefore = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceBefore).to.eq( 0 );

      const creditBalanceBefore = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceBefore).to.eq( 0 );

      await ClaimValue( accAuthorized, claimValue );
      await ApproveAndDepositValue( accAuthorized, depositValue );

      const debetBalanceAfter = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceAfter).to.eq( depositValue - claimValue );

      const creditBalanceAfter = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceAfter).to.eq( 0 );
    });
  });

  describe("Claim after Deposit", async function() {

    const initBalance = 3000;
    const initAccountBalance = 1000

    beforeEach(async function(){
      await InitContracts();
      await SetContractBalance( initBalance );
      await SetAccountBalance( accAuthorized, initAccountBalance  );
      await AddAuthorizedAcc( accAuthorized );
      await SetApproveToDeposit( accAuthorized, initBalance + initAccountBalance);
    });

    it("Success same Claim", async function() {

      const claimValue = 400;
      const depositValue = 400;

      const debetBalanceBefore = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceBefore).to.eq( 0 );

      const creditBalanceBefore = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceBefore).to.eq( 0 );

      await ApproveAndDepositValue( accAuthorized, depositValue );
      await ClaimValue( accAuthorized, claimValue );

      const debetBalanceAfter = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceAfter).to.eq( 0 );

      const creditBalanceAfter = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceAfter).to.eq( 0 );
    });

    it("Success less Claim", async function() {

      const claimValue = 200;
      const depositValue = 400;

      const debetBalanceBefore = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceBefore).to.eq( 0 );

      const creditBalanceBefore = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceBefore).to.eq( 0 );

      await ApproveAndDepositValue( accAuthorized, depositValue );
      await ClaimValue( accAuthorized, claimValue );

      const debetBalanceAfter = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceAfter).to.eq( depositValue - claimValue  );

      const creditBalanceAfter = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceAfter).to.eq( 0 );
    });

    it("Success bigger Claim", async function() {

      const claimValue = 400;
      const depositValue = 200;

      const debetBalanceBefore = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceBefore).to.eq( 0 );

      const creditBalanceBefore = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceBefore).to.eq( 0 );

      await ApproveAndDepositValue( accAuthorized, depositValue );
      await ClaimValue( accAuthorized, claimValue );

      const debetBalanceAfter = await multiBank.balanceOf(accAuthorized.address, debetTokenID);
      expect(debetBalanceAfter).to.eq( 0);

      const creditBalanceAfter = await multiBank.balanceOf(accAuthorized.address, creditTokenID);
      expect(creditBalanceAfter).to.eq( claimValue - depositValue );
    });

  });

});