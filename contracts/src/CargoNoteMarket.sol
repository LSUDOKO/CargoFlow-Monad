// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IEvidenceRegistry} from "./interfaces/IEvidenceRegistry.sol";
import {IFinancingController} from "./interfaces/IFinancingController.sol";
import {IPositionTransfer} from "./interfaces/IPositionTransfer.sol";
import {IReceivableVault} from "./interfaces/IReceivableVault.sol";

interface ILatestEpoch {
    function latestEpochId(bytes32 shipmentId) external view returns (bytes32);
}

/// @title CargoNoteMarket
/// @notice A secondary market for Cargo Notes: the financier's position in a live CargoFlow facility.
///         A note pays principal + fee + undrawn at settlement; the market lets a financier exit before
///         the buyer pays, and lets anyone buy into a shipment while its evidence streams on chain.
///         One ask per note (set by its holder) and any number of escrowed USDC bids. Every fill moves
///         the position through the controller, so settlement, default payouts, the escrowed title and
///         any cover follow the note. The market holds no role and never touches the vault.
///
///         `markPrice` is a reference, computed on chain from the vault and the latest committed epoch:
///         undrawn capital is still in escrow and is marked at par; the drawn principal + fee is marked
///         to the evidence score, with a haircut while the facility is paused. Trades happen at the
///         prices traders choose, not at the mark.
contract CargoNoteMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant BPS = 10_000;
    /// @notice Haircut per score point below 100 on the drawn leg, in bps (score 80 -> 90% of par).
    uint256 public constant HAIRCUT_PER_POINT_BPS = 50;
    /// @notice Extra multiplier on the drawn leg while the facility is paused, in bps.
    uint256 public constant PAUSED_FACTOR_BPS = 7_000;

    IFinancingController public immutable CONTROLLER;
    IReceivableVault public immutable VAULT;
    IERC20 public immutable USDC;
    IEvidenceRegistry public immutable EVIDENCE;

    struct Ask {
        address seller;
        uint256 price;
    }

    mapping(bytes32 shipmentId => Ask) public asks;
    mapping(bytes32 shipmentId => mapping(address bidder => uint256)) public bids;
    mapping(bytes32 shipmentId => address[]) private _bidders;
    mapping(bytes32 shipmentId => mapping(address bidder => bool)) private _known;

    event AskPlaced(bytes32 indexed shipmentId, address indexed seller, uint256 price, uint256 mark);
    event AskCancelled(bytes32 indexed shipmentId, address indexed seller);
    event BidPlaced(bytes32 indexed shipmentId, address indexed bidder, uint256 price, uint256 mark);
    event BidCancelled(bytes32 indexed shipmentId, address indexed bidder, uint256 refund);
    event NoteTraded(
        bytes32 indexed shipmentId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 mark,
        bool takerWasBuyer
    );

    error NotHolder();
    error NotTradeable();
    error NoAsk();
    error StaleAsk();
    error PriceAboveMax();
    error NoBid();
    error BidBelowMin();
    error ZeroPrice();

    constructor(address controller) {
        CONTROLLER = IFinancingController(controller);
        VAULT = CONTROLLER.VAULT();
        USDC = VAULT.USDG();
        EVIDENCE = CONTROLLER.EVIDENCE();
    }

    // ------------------------------------------------------------------ asks

    /// @notice The note's holder offers it at `price` USDC. Approve this market as the position
    ///         operator on the controller (setPositionOperator) for the ask to be fillable.
    function placeAsk(bytes32 shipmentId, uint256 price) external {
        if (price == 0) revert ZeroPrice();
        IFinancingController.FacilityState memory f = CONTROLLER.getFacility(shipmentId);
        if (msg.sender != f.financier) revert NotHolder();
        if (!_tradeable(f.status)) revert NotTradeable();
        asks[shipmentId] = Ask(msg.sender, price);
        emit AskPlaced(shipmentId, msg.sender, price, markPrice(shipmentId));
    }

    function cancelAsk(bytes32 shipmentId) external {
        if (asks[shipmentId].seller != msg.sender) revert NotHolder();
        delete asks[shipmentId];
        emit AskCancelled(shipmentId, msg.sender);
    }

    /// @notice Buys the note at its ask. `maxPrice` guards against the ask moving under the taker.
    function buy(bytes32 shipmentId, uint256 maxPrice) external nonReentrant {
        Ask memory a = asks[shipmentId];
        if (a.seller == address(0)) revert NoAsk();
        if (a.price > maxPrice) revert PriceAboveMax();
        IFinancingController.FacilityState memory f = CONTROLLER.getFacility(shipmentId);
        if (f.financier != a.seller) revert StaleAsk();
        if (!_tradeable(f.status)) revert NotTradeable();
        uint256 mark = markPrice(shipmentId);

        delete asks[shipmentId];
        USDC.safeTransferFrom(msg.sender, a.seller, a.price);
        IPositionTransfer(address(CONTROLLER)).transferPosition(shipmentId, msg.sender);
        emit NoteTraded(shipmentId, a.seller, msg.sender, a.price, mark, true);
    }

    // ------------------------------------------------------------------ bids

    /// @notice Escrows a bid of `price` USDC for the note, replacing (and refunding) any earlier bid
    ///         from the same address.
    function placeBid(bytes32 shipmentId, uint256 price) external nonReentrant {
        if (price == 0) revert ZeroPrice();
        if (!_tradeable(CONTROLLER.getFacility(shipmentId).status)) revert NotTradeable();
        uint256 previous = bids[shipmentId][msg.sender];
        bids[shipmentId][msg.sender] = price;
        if (!_known[shipmentId][msg.sender]) {
            _known[shipmentId][msg.sender] = true;
            _bidders[shipmentId].push(msg.sender);
        }
        if (price > previous) USDC.safeTransferFrom(msg.sender, address(this), price - previous);
        else if (previous > price) USDC.safeTransfer(msg.sender, previous - price);
        emit BidPlaced(shipmentId, msg.sender, price, markPrice(shipmentId));
    }

    /// @notice Withdraws a bid; always allowed, whatever the facility's state.
    function cancelBid(bytes32 shipmentId) external nonReentrant {
        uint256 amount = bids[shipmentId][msg.sender];
        if (amount == 0) revert NoBid();
        delete bids[shipmentId][msg.sender];
        USDC.safeTransfer(msg.sender, amount);
        emit BidCancelled(shipmentId, msg.sender, amount);
    }

    /// @notice The holder sells the note into `bidder`'s escrowed bid (at least `minPrice`).
    function acceptBid(bytes32 shipmentId, address bidder, uint256 minPrice) external nonReentrant {
        IFinancingController.FacilityState memory f = CONTROLLER.getFacility(shipmentId);
        if (msg.sender != f.financier) revert NotHolder();
        if (!_tradeable(f.status)) revert NotTradeable();
        uint256 price = bids[shipmentId][bidder];
        if (price == 0) revert NoBid();
        if (price < minPrice) revert BidBelowMin();
        uint256 mark = markPrice(shipmentId);

        delete bids[shipmentId][bidder];
        delete asks[shipmentId];
        USDC.safeTransfer(msg.sender, price);
        IPositionTransfer(address(CONTROLLER)).transferPosition(shipmentId, bidder);
        emit NoteTraded(shipmentId, msg.sender, bidder, price, mark, false);
    }

    // ------------------------------------------------------------------ views

    /// @notice What the note pays its holder if the buyer settles today: drawn + fee(drawn) + undrawn.
    function claimValue(bytes32 shipmentId) public view returns (uint256) {
        IReceivableVault.Facility memory v = VAULT.getFacility(shipmentId);
        if (v.closed || !v.funded) return 0;
        return v.committed + (v.drawn * v.feeBps) / BPS;
    }

    /// @notice The evidence score the mark uses: the latest committed epoch's score, 100 when none.
    function evidenceScore(bytes32 shipmentId) public view returns (uint32) {
        bytes32 latest = ILatestEpoch(address(EVIDENCE)).latestEpochId(shipmentId);
        if (latest == bytes32(0)) return 100;
        return EVIDENCE.getEpoch(latest).score;
    }

    /// @notice Reference price in USDC base units (see the contract notice). Zero when not tradeable.
    function markPrice(bytes32 shipmentId) public view returns (uint256) {
        IFinancingController.Status s = CONTROLLER.getFacility(shipmentId).status;
        if (!_tradeable(s)) return 0;
        IReceivableVault.Facility memory v = VAULT.getFacility(shipmentId);
        if (v.closed || !v.funded) return 0;
        uint256 undrawn = v.committed - v.drawn;
        uint256 drawnLeg = v.drawn + (v.drawn * v.feeBps) / BPS;
        // delivered: only the buyer's payment is outstanding, so the drawn leg is marked at par
        if (s == IFinancingController.Status.DELIVERED) return undrawn + drawnLeg;
        uint256 score = evidenceScore(shipmentId);
        uint256 factor = BPS - (100 - score) * HAIRCUT_PER_POINT_BPS;
        if (s == IFinancingController.Status.PAUSED) factor = (factor * PAUSED_FACTOR_BPS) / BPS;
        return undrawn + (drawnLeg * factor) / BPS;
    }

    /// @notice The best (highest) open bid and its bidder.
    function bestBid(bytes32 shipmentId) external view returns (address bidder, uint256 price) {
        address[] storage list = _bidders[shipmentId];
        for (uint256 i; i < list.length; ++i) {
            uint256 p = bids[shipmentId][list[i]];
            if (p > price) (bidder, price) = (list[i], p);
        }
    }

    /// @notice Every address that has ever bid on the note (some bids may be cancelled: read `bids`).
    function biddersOf(bytes32 shipmentId) external view returns (address[] memory) {
        return _bidders[shipmentId];
    }

    function _tradeable(IFinancingController.Status s) internal pure returns (bool) {
        return s == IFinancingController.Status.FINANCED || s == IFinancingController.Status.ACTIVE
            || s == IFinancingController.Status.PAUSED || s == IFinancingController.Status.DELIVERED;
    }
}
