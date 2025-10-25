const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CryptoPunksMarketV2", function () {
  // Fixture to deploy the contract
  async function deployCryptoPunksFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy a mock LayerZero endpoint for testing
    const MockLZEndpoint = await ethers.getContractFactory("MockLZEndpoint");
    const lzEndpoint = await MockLZEndpoint.deploy();

    // Deploy CryptoPunksMarketV2
    const CryptoPunksMarketV2 = await ethers.getContractFactory("CryptoPunksMarketV2");
    const cryptoPunks = await CryptoPunksMarketV2.deploy(
      await lzEndpoint.getAddress(),
      owner.address
    );

    return { cryptoPunks, lzEndpoint, owner, addr1, addr2, addr3 };
  }

  describe("Deployment", function () {
    it("Should set the correct total supply", async function () {
      const { cryptoPunks } = await loadFixture(deployCryptoPunksFixture);
      expect(await cryptoPunks.TOTAL_PUNKS()).to.equal(10000);
    });

    it("Should set the correct image hash", async function () {
      const { cryptoPunks } = await loadFixture(deployCryptoPunksFixture);
      const expectedHash = "ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b";
      expect(await cryptoPunks.IMAGE_HASH()).to.equal(expectedHash);
    });

    it("Should initialize with no punks assigned", async function () {
      const { cryptoPunks } = await loadFixture(deployCryptoPunksFixture);
      expect(await cryptoPunks.allPunksAssigned()).to.equal(false);
      expect(await cryptoPunks.punksRemainingToAssign()).to.equal(10000);
    });

    it("Should set the deployer as owner", async function () {
      const { cryptoPunks, owner } = await loadFixture(deployCryptoPunksFixture);
      expect(await cryptoPunks.owner()).to.equal(owner.address);
    });
  });

  describe("Initial Assignment", function () {
    it("Should allow owner to assign initial punks", async function () {
      const { cryptoPunks, owner, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await expect(cryptoPunks.setInitialOwner(addr1.address, 0))
        .to.emit(cryptoPunks, "Assign")
        .withArgs(addr1.address, 0);

      expect(await cryptoPunks.ownerOf(0)).to.equal(addr1.address);
      expect(await cryptoPunks.balanceOf(addr1.address)).to.equal(1);
      expect(await cryptoPunks.punksRemainingToAssign()).to.equal(9999);
    });

    it("Should allow batch assignment", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwners([addr1.address, addr2.address], [0, 1]);

      expect(await cryptoPunks.ownerOf(0)).to.equal(addr1.address);
      expect(await cryptoPunks.ownerOf(1)).to.equal(addr2.address);
      expect(await cryptoPunks.punksRemainingToAssign()).to.equal(9998);
    });

    it("Should revert if non-owner tries to assign", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await expect(
        cryptoPunks.connect(addr1).setInitialOwner(addr1.address, 0)
      ).to.be.revertedWithCustomError(cryptoPunks, "OwnableUnauthorizedAccount");
    });

    it("Should revert assignment after all punks assigned flag is set", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.allInitialOwnersAssigned();
      await expect(
        cryptoPunks.setInitialOwner(addr1.address, 0)
      ).to.be.revertedWithCustomError(cryptoPunks, "AllPunksAlreadyAssigned");
    });

    it("Should revert on invalid punk index", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await expect(
        cryptoPunks.setInitialOwner(addr1.address, 10000)
      ).to.be.revertedWithCustomError(cryptoPunks, "PunkIndexOutOfRange");
    });

    it("Should revert on zero address", async function () {
      const { cryptoPunks } = await loadFixture(deployCryptoPunksFixture);

      await expect(
        cryptoPunks.setInitialOwner(ethers.ZeroAddress, 0)
      ).to.be.revertedWithCustomError(cryptoPunks, "InvalidAddress");
    });
  });

  describe("Get Punk (Public Claiming)", function () {
    it("Should allow claiming unassigned punk after distribution ends", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.allInitialOwnersAssigned();
      await expect(cryptoPunks.connect(addr1).getPunk(100))
        .to.emit(cryptoPunks, "Assign")
        .withArgs(addr1.address, 100);

      expect(await cryptoPunks.ownerOf(100)).to.equal(addr1.address);
    });

    it("Should revert if called before all punks assigned flag", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await expect(
        cryptoPunks.connect(addr1).getPunk(0)
      ).to.be.revertedWithCustomError(cryptoPunks, "PunksNotYetAssigned");
    });

    it("Should revert if punk is already assigned", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 50);
      await cryptoPunks.allInitialOwnersAssigned();

      await expect(
        cryptoPunks.connect(addr2).getPunk(50)
      ).to.be.revertedWithCustomError(cryptoPunks, "PunkAlreadyAssigned");
    });
  });

  describe("Transfer Punk", function () {
    it("Should transfer punk from one address to another", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      await expect(cryptoPunks.connect(addr1).transferPunk(addr2.address, 0))
        .to.emit(cryptoPunks, "PunkTransfer")
        .withArgs(addr1.address, addr2.address, 0);

      expect(await cryptoPunks.ownerOf(0)).to.equal(addr2.address);
    });

    it("Should remove punk from sale when transferred", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();
      await cryptoPunks.connect(addr1).offerPunkForSale(0, ethers.parseEther("1"));

      await cryptoPunks.connect(addr1).transferPunk(addr2.address, 0);

      const offer = await cryptoPunks.getPunkOffer(0);
      expect(offer.isForSale).to.equal(false);
    });

    it("Should revert if non-owner tries to transfer", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      await expect(
        cryptoPunks.connect(addr2).transferPunk(addr2.address, 0)
      ).to.be.revertedWithCustomError(cryptoPunks, "NotPunkOwner");
    });

    it("Should refund recipient's bid on transfer", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      // addr2 places a bid
      const bidAmount = ethers.parseEther("1");
      await cryptoPunks.connect(addr2).enterBidForPunk(0, { value: bidAmount });

      // Transfer punk to addr2
      await cryptoPunks.connect(addr1).transferPunk(addr2.address, 0);

      // Check that bid was refunded to pendingWithdrawals
      expect(await cryptoPunks.pendingWithdrawals(addr2.address)).to.equal(bidAmount);
    });
  });

  describe("Offer Punk For Sale", function () {
    it("Should allow owner to offer punk for sale", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const price = ethers.parseEther("1");
      await expect(cryptoPunks.connect(addr1).offerPunkForSale(0, price))
        .to.emit(cryptoPunks, "PunkOffered")
        .withArgs(0, price, ethers.ZeroAddress);

      const offer = await cryptoPunks.getPunkOffer(0);
      expect(offer.isForSale).to.equal(true);
      expect(offer.minValue).to.equal(price);
      expect(offer.seller).to.equal(addr1.address);
    });

    it("Should allow offering to specific address", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const price = ethers.parseEther("1");
      await cryptoPunks.connect(addr1).offerPunkForSaleToAddress(0, price, addr2.address);

      const offer = await cryptoPunks.getPunkOffer(0);
      expect(offer.onlySellTo).to.equal(addr2.address);
    });

    it("Should revert if non-owner tries to offer", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      await expect(
        cryptoPunks.connect(addr2).offerPunkForSale(0, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(cryptoPunks, "NotPunkOwner");
    });
  });

  describe("Buy Punk", function () {
    it("Should allow buying a punk that is for sale", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const price = ethers.parseEther("1");
      await cryptoPunks.connect(addr1).offerPunkForSale(0, price);

      await expect(
        cryptoPunks.connect(addr2).buyPunk(0, { value: price })
      ).to.emit(cryptoPunks, "PunkBought")
        .withArgs(0, price, addr1.address, addr2.address);

      expect(await cryptoPunks.ownerOf(0)).to.equal(addr2.address);
      expect(await cryptoPunks.pendingWithdrawals(addr1.address)).to.equal(price);
    });

    it("Should revert if punk is not for sale", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      await expect(
        cryptoPunks.connect(addr2).buyPunk(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(cryptoPunks, "PunkNotForSale");
    });

    it("Should revert if payment is insufficient", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const price = ethers.parseEther("1");
      await cryptoPunks.connect(addr1).offerPunkForSale(0, price);

      await expect(
        cryptoPunks.connect(addr2).buyPunk(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(cryptoPunks, "InsufficientPayment");
    });

    it("Should revert if buyer is not the intended recipient", async function () {
      const { cryptoPunks, addr1, addr2, addr3 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const price = ethers.parseEther("1");
      await cryptoPunks.connect(addr1).offerPunkForSaleToAddress(0, price, addr2.address);

      await expect(
        cryptoPunks.connect(addr3).buyPunk(0, { value: price })
      ).to.be.revertedWithCustomError(cryptoPunks, "NotIntendedBuyer");
    });

    it("Should refund buyer's own bid when buying", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      // addr2 places a bid
      const bidAmount = ethers.parseEther("0.5");
      await cryptoPunks.connect(addr2).enterBidForPunk(0, { value: bidAmount });

      // addr1 offers for sale
      const price = ethers.parseEther("1");
      await cryptoPunks.connect(addr1).offerPunkForSale(0, price);

      // addr2 buys
      await cryptoPunks.connect(addr2).buyPunk(0, { value: price });

      // Check that bid was refunded
      expect(await cryptoPunks.pendingWithdrawals(addr2.address)).to.equal(bidAmount);
    });
  });

  describe("Bidding", function () {
    it("Should allow entering a bid for a punk", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const bidAmount = ethers.parseEther("1");
      await expect(
        cryptoPunks.connect(addr2).enterBidForPunk(0, { value: bidAmount })
      ).to.emit(cryptoPunks, "PunkBidEntered")
        .withArgs(0, bidAmount, addr2.address);

      const bid = await cryptoPunks.getPunkBid(0);
      expect(bid.hasBid).to.equal(true);
      expect(bid.value).to.equal(bidAmount);
      expect(bid.bidder).to.equal(addr2.address);
    });

    it("Should refund previous bidder when new higher bid is placed", async function () {
      const { cryptoPunks, addr1, addr2, addr3 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const bid1 = ethers.parseEther("1");
      const bid2 = ethers.parseEther("2");

      await cryptoPunks.connect(addr2).enterBidForPunk(0, { value: bid1 });
      await cryptoPunks.connect(addr3).enterBidForPunk(0, { value: bid2 });

      expect(await cryptoPunks.pendingWithdrawals(addr2.address)).to.equal(bid1);
    });

    it("Should revert if bid is not higher than existing bid", async function () {
      const { cryptoPunks, addr1, addr2, addr3 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const bid1 = ethers.parseEther("2");
      const bid2 = ethers.parseEther("1");

      await cryptoPunks.connect(addr2).enterBidForPunk(0, { value: bid1 });

      await expect(
        cryptoPunks.connect(addr3).enterBidForPunk(0, { value: bid2 })
      ).to.be.revertedWithCustomError(cryptoPunks, "BidTooLow");
    });

    it("Should revert if bidding on own punk", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      await expect(
        cryptoPunks.connect(addr1).enterBidForPunk(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(cryptoPunks, "CannotBidOnOwnPunk");
    });

    it("Should allow owner to accept a bid", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const bidAmount = ethers.parseEther("1");
      await cryptoPunks.connect(addr2).enterBidForPunk(0, { value: bidAmount });

      await expect(
        cryptoPunks.connect(addr1).acceptBidForPunk(0, bidAmount)
      ).to.emit(cryptoPunks, "PunkBought")
        .withArgs(0, bidAmount, addr1.address, addr2.address);

      expect(await cryptoPunks.ownerOf(0)).to.equal(addr2.address);
      expect(await cryptoPunks.pendingWithdrawals(addr1.address)).to.equal(bidAmount);
    });

    it("Should allow bidder to withdraw bid", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const bidAmount = ethers.parseEther("1");
      await cryptoPunks.connect(addr2).enterBidForPunk(0, { value: bidAmount });

      const balanceBefore = await ethers.provider.getBalance(addr2.address);

      await expect(
        cryptoPunks.connect(addr2).withdrawBidForPunk(0)
      ).to.emit(cryptoPunks, "PunkBidWithdrawn")
        .withArgs(0, bidAmount, addr2.address);

      const bid = await cryptoPunks.getPunkBid(0);
      expect(bid.hasBid).to.equal(false);
    });
  });

  describe("Withdrawals", function () {
    it("Should allow withdrawal of pending funds", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      const price = ethers.parseEther("1");
      await cryptoPunks.connect(addr1).offerPunkForSale(0, price);
      await cryptoPunks.connect(addr2).buyPunk(0, { value: price });

      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      const tx = await cryptoPunks.connect(addr1).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(addr1.address);
      expect(balanceAfter).to.equal(balanceBefore + price - gasUsed);
      expect(await cryptoPunks.pendingWithdrawals(addr1.address)).to.equal(0);
    });

    it("Should revert if no funds to withdraw", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.allInitialOwnersAssigned();

      await expect(
        cryptoPunks.connect(addr1).withdraw()
      ).to.be.revertedWithCustomError(cryptoPunks, "NoFundsToWithdraw");
    });
  });

  describe("Pausable", function () {
    it("Should allow owner to pause and unpause", async function () {
      const { cryptoPunks, owner } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.pause();
      expect(await cryptoPunks.paused()).to.equal(true);

      await cryptoPunks.unpause();
      expect(await cryptoPunks.paused()).to.equal(false);
    });

    it("Should prevent buying when paused", async function () {
      const { cryptoPunks, addr1, addr2 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();
      await cryptoPunks.connect(addr1).offerPunkForSale(0, ethers.parseEther("1"));

      await cryptoPunks.pause();

      await expect(
        cryptoPunks.connect(addr2).buyPunk(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(cryptoPunks, "EnforcedPause");
    });
  });

  describe("Remove Punk From Sale", function () {
    it("Should allow owner to remove punk from sale", async function () {
      const { cryptoPunks, addr1 } = await loadFixture(deployCryptoPunksFixture);

      await cryptoPunks.setInitialOwner(addr1.address, 0);
      await cryptoPunks.allInitialOwnersAssigned();

      await cryptoPunks.connect(addr1).offerPunkForSale(0, ethers.parseEther("1"));

      await expect(cryptoPunks.connect(addr1).punkNoLongerForSale(0))
        .to.emit(cryptoPunks, "PunkNoLongerForSale")
        .withArgs(0);

      const offer = await cryptoPunks.getPunkOffer(0);
      expect(offer.isForSale).to.equal(false);
    });
  });
});
