const {
  loadFixture,
  time
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sisan", function () {
  async function deploySisanFixture() {
    const [owner] = await ethers.getSigners();

    const Sisan = await ethers.getContractFactory("Sisan");
    const sisan = await Sisan.deploy(owner);
    const sisanContractAddress = sisan.getAddress();

    return { sisan, owner, sisanContractAddress };
  }

  async function deployERC20Fixture() {
    const [owner] = await ethers.getSigners();

    const tokenName = "Token";
    const tokenSymbol = "TKN";

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy(owner, tokenName, tokenSymbol);
    const tokenContractAddress = token.getAddress();

    return { token, owner, tokenContractAddress, tokenName, tokenSymbol };
  }

  describe("Deployment", function () {
    describe("ERC20 Token deployment", function () {
      it("Should deploy ERC20 token", async function () {
        const { token, owner, tokenName, tokenSymbol } = await loadFixture(deployERC20Fixture);

        expect(await token.owner()).to.equal(owner);
        expect(await token.name()).to.equal(tokenName);
        expect(await token.symbol()).to.equal(tokenSymbol);
      })
    })

    describe("Sisan deployment", function () {
      it("Should set the right owner", async function () {
        const { sisan, owner } = await loadFixture(deploySisanFixture);

        expect(await sisan.owner()).to.equal(owner)
      })
    })
  })

  describe("Create Invoice", function () {
    it("Should create a one time payment invoice", async function () {
      const [_, alice] = await ethers.getSigners();
      const {tokenContractAddress} = await loadFixture(deployERC20Fixture);
      const { sisan, owner } = await loadFixture(deploySisanFixture);

      const amount0 = 0n; 
      const recurrent =  false; 
      const numberOfRecurrentPayment = 0n;
      const recurrentPaymentInterval = 0n;
      const validPaymentToken = tokenContractAddress;
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      expect(await sisan.connect(owner).createInvoice(
        amount0,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount0, validPaymentToken
      );
    })

    it("Should create a one to one recurrent payment invoice", async function () {
      const [_, alice] = await ethers.getSigners();
      const {tokenContractAddress} = await loadFixture(deployERC20Fixture);
      const { sisan, owner } = await loadFixture(deploySisanFixture);

      const amount0 = 0n; 
      const recurrent =  true; 
      const numberOfRecurrentPayment = 3n;
      const recurrentPaymentInterval = 7n;
      const validPaymentToken = tokenContractAddress;
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      expect(await sisan.connect(owner).createInvoice(
        amount0,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount0, validPaymentToken
      );
    })

    it("Should create a one to many single payment invoice", async function () {
      const [_, alice, bob, charlie] = await ethers.getSigners();
      const {tokenContractAddress} = await loadFixture(deployERC20Fixture);
      const { sisan, owner } = await loadFixture(deploySisanFixture);

      const amount0 = 0n; 
      const recurrent =  false; 
      const numberOfRecurrentPayment = 0n;
      const recurrentPaymentInterval = 0n;
      const validPaymentToken = tokenContractAddress;
      const payers = [alice, bob, charlie]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      expect(await sisan.connect(owner).createInvoice(
        amount0,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount0, validPaymentToken
      );
    })

    it("Should create a one to many recurrent payment invoice", async function () {
      const [_, alice, bob, charlie] = await ethers.getSigners();
      const {tokenContractAddress} = await loadFixture(deployERC20Fixture);
      const { sisan, owner } = await loadFixture(deploySisanFixture);

      const amount0 = 0n; 
      const recurrent =  true; 
      const numberOfRecurrentPayment = 2n;
      const recurrentPaymentInterval = 7n;
      const validPaymentToken = tokenContractAddress;
      const payers = [ alice, bob, charlie]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      expect(await sisan.connect(owner).createInvoice(
        amount0,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount0, validPaymentToken
      );
    })
  })

  describe("Create and Accept Invoice", function () {
    it("Should accept a one to one single eth payment invoice", async function () {
      const [_, alice] = await ethers.getSigners();
      const { sisan, owner } = await loadFixture(deploySisanFixture);

      const amount1 = 1n; 
      const recurrent =  false; 
      const numberOfRecurrentPayment = 0n;
      const recurrentPaymentInterval = 0n;
      const validPaymentToken = "0x0000000000000000000000000000000000000000";
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      expect(await sisan.connect(owner).createInvoice(
        amount1,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount1, validPaymentToken
      );

      expect(await sisan.connect(alice).acceptInvoice(currentInvoiceIdx, false, {value: 1n}))
    });

    it("Should accept a one to one single erc20 payment invoice", async function () {
      const [_, alice] = await ethers.getSigners();
      const {tokenContractAddress, token} = await loadFixture(deployERC20Fixture);
      const { sisan, owner, sisanContractAddress } = await loadFixture(deploySisanFixture);

      const amount1 = 1n; 
      const recurrent =  false; 
      const numberOfRecurrentPayment = 0n;
      const recurrentPaymentInterval = 0n;
      const validPaymentToken = tokenContractAddress;
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      expect(await sisan.connect(owner).createInvoice(
        amount1,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount1, validPaymentToken
      );

      await token.connect(owner).mint(alice, 10);
      await token.connect(alice).approve(sisanContractAddress, amount1)
      expect(
        await sisan.connect(alice).acceptInvoice(
          currentInvoiceIdx, 
          false, 
          {value: 1n}
        )).to.emit(sisan, "InvoiceAccepted").withArgs(currentInvoiceIdx, alice, amount1, validPaymentToken)
    });
  });

  describe("Create, Accept, and Cancel Invoice", function () {
    it("Should cancel a one to one single eth payment invoice", async function () {
      const [_, alice] = await ethers.getSigners();
      const { sisan, owner } = await loadFixture(deploySisanFixture);

      const amount1 = 1n; 
      const recurrent =  false; 
      const numberOfRecurrentPayment = 0n;
      const recurrentPaymentInterval = 0n;
      const validPaymentToken = "0x0000000000000000000000000000000000000000";
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();
      
      expect(await sisan.connect(owner).createInvoice(
        amount1,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount1, validPaymentToken
      );

      expect(await sisan.connect(alice).acceptInvoice(currentInvoiceIdx, false, {value: 1n}));
      expect(
        await sisan.connect(alice).cancelPayment(currentInvoiceIdx))
        .to.emit(sisan, "PaymentCanceled").withArgs(currentInvoiceIdx, owner, alice
      );
    });

    it("Should cancel a one to one single erc20 payment invoice", async function () {
      const [_, alice] = await ethers.getSigners();
      const {tokenContractAddress, token} = await loadFixture(deployERC20Fixture);
      const { sisan, owner, sisanContractAddress } = await loadFixture(deploySisanFixture);

      const amount1 = 1n; 
      const recurrent =  false; 
      const numberOfRecurrentPayment = 0n;
      const recurrentPaymentInterval = 0n;
      const validPaymentToken = tokenContractAddress;
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      expect(await sisan.connect(owner).createInvoice(
        amount1,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount1, validPaymentToken
      );

      await token.connect(owner).mint(alice, 10);

      const contractERC20Balance = await token.balanceOf(sisanContractAddress);
      const aliceERC20Balance = await token.balanceOf(alice); 

      await token.connect(alice).approve(sisanContractAddress, amount1)
      expect(
        await sisan.connect(alice).acceptInvoice(
          currentInvoiceIdx, 
          false, 
          {value: 1n}
        )
      ).to.emit(sisan, "InvoiceAccepted").withArgs(currentInvoiceIdx, alice, amount1, validPaymentToken)

      expect(await token.balanceOf(sisanContractAddress)).to.equal(contractERC20Balance + 1n);
      expect(await token.balanceOf(alice)).to.equal(aliceERC20Balance - 1n);

      expect(
        await sisan.connect(alice).cancelPayment(currentInvoiceIdx))
        .to.emit(sisan, "PaymentCanceled").withArgs(currentInvoiceIdx, owner, alice
      );
    });
  });

  describe("Create, Accept Invoice and withdraw payment", function () {
    it("Should withdraw payment of a one to one single eth payment invoice", async function () {
      const [_, alice] = await ethers.getSigners();
      const { sisan, owner } = await loadFixture(deploySisanFixture);

      const amount10 = 1n; 
      const recurrent =  false; 
      const numberOfRecurrentPayment = 1n;
      const recurrentPaymentInterval = 0n;
      const validPaymentToken = "0x0000000000000000000000000000000000000000";
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      await sisan.connect(owner).createInvoice(
        amount10,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )

      await sisan.connect(alice).acceptInvoice(currentInvoiceIdx, false, {value: 1n});

      expect(await sisan.connect(owner).withdrawPayment(currentInvoiceIdx, alice)).to
        .emit(sisan, "InvoiceCompleted").withArgs(currentInvoiceIdx);
    });

    it("Should withdraw a one to one single erc20 payment invoice", async function () {
      const [_, alice] = await ethers.getSigners();
      const {tokenContractAddress, token} = await loadFixture(deployERC20Fixture);
      const { sisan, owner, sisanContractAddress } = await loadFixture(deploySisanFixture);

      const amount1 = 1n; 
      const recurrent =  false; 
      const numberOfRecurrentPayment = 1n;
      const recurrentPaymentInterval = 0n;
      const validPaymentToken = tokenContractAddress;
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      expect(await sisan.connect(owner).createInvoice(
        amount1,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )).to.emit(
        sisan, "InvoiceCreated").withArgs(currentInvoiceIdx, owner, amount1, validPaymentToken
      );

      await token.connect(owner).mint(alice, 10);
      await token.connect(alice).approve(sisanContractAddress, amount1)
      expect(
        await sisan.connect(alice).acceptInvoice(
          currentInvoiceIdx, 
          false, 
          {value: 1n}
        )
      ).to.emit(sisan, "InvoiceAccepted").withArgs(currentInvoiceIdx, alice, amount1, validPaymentToken)

      expect(await sisan.connect(owner).withdrawPayment(currentInvoiceIdx, alice)).to
        .emit(sisan, "PaymentWithdrawn").withArgs(currentInvoiceIdx);

      expect(amount1).to.equal(await token.balanceOf(owner));
    });
  });

  describe("View methods", function () {
    it("try out view methods", async function () {
      const [_, alice] = await ethers.getSigners();
      const { sisan, owner } = await loadFixture(deploySisanFixture);

      const amount10 = 1n; 
      const recurrent =  true; 
      const numberOfRecurrentPayment = 1n;
      const recurrentPaymentInterval = 1n;
      const validPaymentToken = "0x0000000000000000000000000000000000000000";
      const payers = [alice]
      const criticalPeriod = 7152n * 7n;

      const currentInvoiceIdx = await sisan.currentInvoiceIdx();

      await sisan.connect(owner).createInvoice(
        amount10,
        recurrent,
        numberOfRecurrentPayment,
        recurrentPaymentInterval,
        criticalPeriod,
        validPaymentToken,
        payers
      )

      await sisan.connect(alice).acceptInvoice(currentInvoiceIdx, true, {value: 1n});

      const invoice = await sisan.getInvoice(currentInvoiceIdx);
      expect(invoice.recurrent).to.equal(recurrent);

      const invoiceBalance = await sisan.getInvoiceBalance(owner, alice, currentInvoiceIdx);
      expect(amount10).to.equal(invoiceBalance);

      const invoice1 = await sisan.getInvoiceByCreatorAndIdx(owner, currentInvoiceIdx);
      expect(invoice.recurrent).to.equal(invoice1.recurrent);

      const invoice2 = await sisan.getInvoiceByPayerAndIdx(alice, currentInvoiceIdx);
      expect(invoice1.recurrent).to.equal(invoice2.recurrent);
    });
  });
});
