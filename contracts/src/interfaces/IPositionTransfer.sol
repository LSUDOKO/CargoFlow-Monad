// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Monad additions to the FinancingController: the financier's position in a facility (the
///         right to principal + fee + undrawn at settlement, the escrowed title on default and any
///         accepted cover) becomes a transferable claim, a "Cargo Note". Every v3 function is unchanged.
interface IPositionTransfer {
    event PositionOperatorSet(bytes32 indexed shipmentId, address indexed financier, address indexed operator);
    event PositionTransferred(bytes32 indexed shipmentId, address indexed from, address indexed to);

    error NotPositionHolder();
    error PositionNotTransferable();

    /// @notice The current financier approves `operator` (e.g. the note market) to transfer the
    ///         position once. address(0) clears it. Cleared on every transfer.
    function setPositionOperator(bytes32 shipmentId, address operator) external;

    /// @notice Moves the financier position to `to`. The financier or its approved operator; only while
    ///         FINANCED, ACTIVE, PAUSED or DELIVERED (never DISPUTED or closed); `to` must not be zero,
    ///         the exporter or the buyer. Settlement, default payouts and cover then go to `to`.
    function transferPosition(bytes32 shipmentId, address to) external;

    /// @notice The operator approved for the position (address(0) when none).
    function positionOperator(bytes32 shipmentId) external view returns (address);
}
