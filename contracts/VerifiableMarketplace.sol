// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title VerifiableMarketplace
 * @dev A decentralized marketplace with AI-verified listings and agent-based transactions
 */
contract VerifiableMarketplace is Ownable, ReentrancyGuard, Pausable {
    // Marketplace fee in basis points (250 = 2.5%)
    uint256 public marketplaceFee = 250;
    uint256 public constant MAX_FEE = 1000; // 10% maximum fee

    // Listing structure
    struct Listing {
        address seller;
        uint256 price;
        bool sold;
        bytes32 aiProofHash;
        uint256 createdAt;
    }

    // Mappings
    mapping(string => Listing) public listings;
    mapping(address => uint256) public sellerBalances;

    // Events
    event ListingCreated(
        string indexed listingId,
        address indexed seller,
        uint256 price,
        bytes32 aiProofHash
    );

    event ListingPurchased(
        string indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );

    event MarketplaceFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );

    event FundsWithdrawn(
        address indexed recipient,
        uint256 amount
    );

    // Custom errors for gas optimization
    error InvalidPrice();
    error ListingAlreadyExists();
    error ListingNotFound();
    error ListingAlreadySold();
    error InsufficientPayment();
    error TransferFailed();
    error InvalidFee();
    error NoBalanceToWithdraw();

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Creates a new listing with AI-generated proof
     * @param listingId Unique identifier for the listing
     * @param price Price in wei
     * @param aiProofHash Hash of the AI analysis proof
     */
    function createListing(
        string calldata listingId,
        uint256 price,
        bytes32 aiProofHash
    ) external whenNotPaused {
        // Validate inputs
        if (price == 0) revert InvalidPrice();
        if (listings[listingId].seller != address(0)) revert ListingAlreadyExists();

        // Create listing
        listings[listingId] = Listing({
            seller: msg.sender,
            price: price,
            sold: false,
            aiProofHash: aiProofHash,
            createdAt: block.timestamp
        });

        emit ListingCreated(listingId, msg.sender, price, aiProofHash);
    }

    /**
     * @dev Purchase a listing
     * @param listingId The ID of the listing to purchase
     */
    function purchaseListing(
        string calldata listingId
    ) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];

        // Validate listing
        if (listing.seller == address(0)) revert ListingNotFound();
        if (listing.sold) revert ListingAlreadySold();
        if (msg.value < listing.price) revert InsufficientPayment();

        // Mark as sold
        listing.sold = true;

        // Calculate fees
        uint256 fee = (listing.price * marketplaceFee) / 10000;
        uint256 sellerAmount = listing.price - fee;

        // Transfer funds to seller
        (bool success, ) = listing.seller.call{value: sellerAmount}("");
        if (!success) revert TransferFailed();

        // Store marketplace fee
        sellerBalances[owner()] += fee;

        // Refund excess payment if any
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - listing.price}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit ListingPurchased(listingId, msg.sender, listing.seller, listing.price);
    }

    /**
     * @dev Update marketplace fee (owner only)
     * @param newFee New fee in basis points
     */
    function updateMarketplaceFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE) revert InvalidFee();

        uint256 oldFee = marketplaceFee;
        marketplaceFee = newFee;

        emit MarketplaceFeeUpdated(oldFee, newFee);
    }

    /**
     * @dev Withdraw accumulated fees (owner only)
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = sellerBalances[owner()];
        if (balance == 0) revert NoBalanceToWithdraw();

        sellerBalances[owner()] = 0;

        (bool success, ) = owner().call{value: balance}("");
        if (!success) revert TransferFailed();

        emit FundsWithdrawn(owner(), balance);
    }

    /**
     * @dev Pause contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Override transferOwnership to handle accumulated fees
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        // Transfer accumulated fees to new owner before ownership transfer
        address currentOwner = owner();
        uint256 accumulatedFees = sellerBalances[currentOwner];

        if (accumulatedFees > 0) {
            sellerBalances[currentOwner] = 0;
            sellerBalances[newOwner] = accumulatedFees;
        }

        // Call parent implementation
        super.transferOwnership(newOwner);
    }

    /**
     * @dev Get listing details
     * @param listingId The ID of the listing
     */
    function getListing(string calldata listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /**
     * @dev Check if contract is paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        // Accept ETH deposits
    }

    /**
     * @dev Fallback function
     */
    fallback() external payable {
        // Fallback for calls with data
    }
}