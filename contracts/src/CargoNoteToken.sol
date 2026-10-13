// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IFinancingController} from "./interfaces/IFinancingController.sol";
import {IPositionTransfer} from "./interfaces/IPositionTransfer.sol";

interface ICoverWithdraw {
    function withdraw() external;
}

/// @title CargoNoteToken
/// @notice A Cargo Note made fungible: the token contract itself becomes the facility's financier of
///         record, and its supply (6 decimals) equals the note's claim at wrap time, so one token is a
///         claim on about one USDC at settlement. Everything the position later receives (the buyer's
///         settlement, the undrawn refund on default or cancel, cover payouts) lands in this contract
///         and is shared pro-rata: holders burn tokens for USDC once the facility is closed. Being a
///         plain ERC-20, the note can then trade on any spot order book, e.g. a Kuru market.
contract CargoNoteToken is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IFinancingController public immutable CONTROLLER;
    IERC20 public immutable USDC;
    bytes32 public immutable SHIPMENT_ID;
    /// @notice The claim (USDC base units) the supply was minted against.
    uint256 public immutable CLAIM_AT_WRAP;

    event Redeemed(address indexed holder, uint256 tokens, uint256 usdc);

    error NotClosed();
    error ZeroAmount();

    constructor(
        IFinancingController controller,
        IERC20 usdc,
        bytes32 shipmentId,
        uint256 claim,
        address to,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        CONTROLLER = controller;
        USDC = usdc;
        SHIPMENT_ID = shipmentId;
        CLAIM_AT_WRAP = claim;
        _mint(to, claim);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Whether the facility is closed (settled, defaulted or cancelled), i.e. redeemable.
    function closed() public view returns (bool) {
        IFinancingController.Status s = CONTROLLER.getFacility(SHIPMENT_ID).status;
        return s == IFinancingController.Status.SETTLED || s == IFinancingController.Status.DEFAULTED
            || s == IFinancingController.Status.CANCELLED;
    }

    /// @notice USDC that `tokens` redeem for right now (zero until closed).
    function previewRedeem(uint256 tokens) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0 || !closed()) return 0;
        return (USDC.balanceOf(address(this)) * tokens) / supply;
    }

    /// @notice Burns `tokens` for their pro-rata share of the USDC this note has received.
    function redeem(uint256 tokens) external nonReentrant returns (uint256 usdc) {
        if (tokens == 0) revert ZeroAmount();
        if (!closed()) revert NotClosed();
        usdc = (USDC.balanceOf(address(this)) * tokens) / totalSupply();
        _burn(msg.sender, tokens);
        USDC.safeTransfer(msg.sender, usdc);
        emit Redeemed(msg.sender, tokens, usdc);
    }

    /// @notice Pulls any cover payout credited to this note from the CoverPool. Anyone may call.
    function claimCover(address coverPool) external {
        ICoverWithdraw(coverPool).withdraw();
    }
}

interface INoteMarketViews {
    function claimValue(bytes32 shipmentId) external view returns (uint256);
}

/// @title CargoNoteWrapper
/// @notice Turns a Cargo Note into a CargoNoteToken. The note's holder approves this wrapper as the
///         position operator on the controller (setPositionOperator) and calls `wrap`; the position
///         moves to a fresh token contract and the holder receives the full supply.
contract CargoNoteWrapper {
    IFinancingController public immutable CONTROLLER;
    IERC20 public immutable USDC;
    INoteMarketViews public immutable MARKET;

    mapping(bytes32 shipmentId => address) public tokenOf;

    event NoteWrapped(bytes32 indexed shipmentId, address indexed token, address indexed holder, uint256 supply);

    error NotHolder();
    error AlreadyWrapped();
    error NothingToWrap();

    constructor(address controller, address market) {
        CONTROLLER = IFinancingController(controller);
        USDC = IERC20(address(CONTROLLER.VAULT().USDG()));
        MARKET = INoteMarketViews(market);
    }

    function wrap(bytes32 shipmentId, string calldata symbol) external returns (address token) {
        if (CONTROLLER.getFacility(shipmentId).financier != msg.sender) revert NotHolder();
        if (tokenOf[shipmentId] != address(0)) revert AlreadyWrapped();
        uint256 claim = MARKET.claimValue(shipmentId);
        if (claim == 0) revert NothingToWrap();
        token = address(
            new CargoNoteToken(
                CONTROLLER, USDC, shipmentId, claim, msg.sender, string.concat("Cargo Note ", symbol), symbol
            )
        );
        tokenOf[shipmentId] = token;
        IPositionTransfer(address(CONTROLLER)).transferPosition(shipmentId, token);
        emit NoteWrapped(shipmentId, token, msg.sender, claim);
    }
}
