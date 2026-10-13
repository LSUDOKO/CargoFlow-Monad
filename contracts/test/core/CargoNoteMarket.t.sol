// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CargoNoteMarket} from "../../src/CargoNoteMarket.sol";
import {IFinancingController} from "../../src/interfaces/IFinancingController.sol";
import {IPositionTransfer} from "../../src/interfaces/IPositionTransfer.sol";
import {ControllerBase} from "./ControllerBase.sol";

contract CargoNoteMarketTest is ControllerBase {
    CargoNoteMarket internal market;
    address internal trader = makeAddr("trader");
    address internal trader2 = makeAddr("trader2");

    function setUp() public override {
        super.setUp();
        market = new CargoNoteMarket(address(controller));
        for (uint256 i; i < 2; ++i) {
            address t = i == 0 ? trader : trader2;
            usdg.mint(t, 100_000e6);
            vm.prank(t);
            usdg.approve(address(market), type(uint256).max);
        }
    }

    function _releaseTwo() internal {
        _activate();
        for (uint8 i; i < 2; ++i) {
            _commitEvidence(i, 1, 95, 300);
            vm.prank(exporter);
            controller.evaluateAndReleaseMilestone(id, i, 1);
        }
    }

    function _list(uint256 price) internal {
        vm.startPrank(financier);
        IPositionTransfer(address(controller)).setPositionOperator(id, address(market));
        market.placeAsk(id, price);
        vm.stopPrank();
    }

    // --- marks ---------------------------------------------------------------------------

    function test_markIsParWhenNothingDrawn() public {
        _fund();
        assertEq(market.claimValue(id), COMMITTED);
        assertEq(market.markPrice(id), COMMITTED);
    }

    function test_markHaircutsDrawnLegByScore() public {
        _releaseTwo(); // 16k drawn, latest score 95
        uint256 drawnLeg = 16_000e6 + (16_000e6 * uint256(FEE_BPS)) / 10_000;
        uint256 expected = (COMMITTED - 16_000e6) + (drawnLeg * (10_000 - 5 * 50)) / 10_000;
        assertEq(market.markPrice(id), expected);
        assertEq(market.claimValue(id), COMMITTED + (16_000e6 * uint256(FEE_BPS)) / 10_000);
    }

    function test_markDropsWhilePaused() public {
        _releaseTwo();
        uint256 active = market.markPrice(id);
        _commitEvidence(2, 1, 48, 7800);
        uint256 lowScore = market.markPrice(id);
        assertLt(lowScore, active);
        vm.prank(monitor);
        controller.pauseFinancing(id, THERMAL);
        assertLt(market.markPrice(id), lowScore);
    }

    // --- asks ----------------------------------------------------------------------------

    function test_buyMovesPositionAndSettlementFollowsTheNote() public {
        _releaseTwo();
        _list(39_000e6);
        uint256 sellerBefore = usdg.balanceOf(financier);

        vm.prank(trader);
        market.buy(id, 39_000e6);

        assertEq(controller.getFacility(id).financier, trader);
        assertEq(vault.getFacility(id).financier, trader);
        assertEq(usdg.balanceOf(financier), sellerBefore + 39_000e6);
        assertEq(IPositionTransfer(address(controller)).positionOperator(id), address(0));

        // the remaining milestones clear and the buyer pays: the note holder is repaid
        for (uint8 i = 2; i < 5; ++i) {
            _commitEvidence(i, 1, 95, 300);
            vm.prank(exporter);
            controller.evaluateAndReleaseMilestone(id, i, 1);
        }
        uint256 traderBefore = usdg.balanceOf(trader);
        vm.prank(buyer);
        controller.markDelivered(id);
        vm.prank(buyer);
        controller.settle(id);
        assertEq(usdg.balanceOf(trader), traderBefore + COMMITTED + (COMMITTED * uint256(FEE_BPS)) / 10_000);
    }

    function test_buyRevertsAboveMaxPrice() public {
        _releaseTwo();
        _list(39_000e6);
        vm.prank(trader);
        vm.expectRevert(CargoNoteMarket.PriceAboveMax.selector);
        market.buy(id, 38_000e6);
    }

    function test_buyRevertsWithoutOperatorApproval() public {
        _releaseTwo();
        vm.prank(financier);
        market.placeAsk(id, 39_000e6);
        vm.prank(trader);
        vm.expectRevert(IPositionTransfer.NotPositionHolder.selector);
        market.buy(id, 39_000e6);
    }

    function test_onlyHolderCanAsk() public {
        _releaseTwo();
        vm.prank(stranger);
        vm.expectRevert(CargoNoteMarket.NotHolder.selector);
        market.placeAsk(id, 1);
    }

    function test_staleAskAfterDirectTransferCannotFill() public {
        _releaseTwo();
        _list(39_000e6);
        vm.prank(financier);
        IPositionTransfer(address(controller)).transferPosition(id, trader2);
        vm.prank(trader);
        vm.expectRevert(CargoNoteMarket.StaleAsk.selector);
        market.buy(id, 39_000e6);
    }

    // --- bids ----------------------------------------------------------------------------

    function test_bidEscrowAcceptAndBestBid() public {
        _releaseTwo();
        vm.prank(trader);
        market.placeBid(id, 30_000e6);
        vm.prank(trader2);
        market.placeBid(id, 31_000e6);
        (address best, uint256 price) = market.bestBid(id);
        assertEq(best, trader2);
        assertEq(price, 31_000e6);
        assertEq(usdg.balanceOf(address(market)), 61_000e6);

        uint256 before = usdg.balanceOf(financier);
        vm.startPrank(financier);
        IPositionTransfer(address(controller)).setPositionOperator(id, address(market));
        market.acceptBid(id, trader2, 31_000e6);
        vm.stopPrank();
        assertEq(controller.getFacility(id).financier, trader2);
        assertEq(usdg.balanceOf(financier), before + 31_000e6);

        vm.prank(trader);
        market.cancelBid(id);
        assertEq(usdg.balanceOf(address(market)), 0);
    }

    function test_rebidRefundsTheDifference() public {
        _releaseTwo();
        vm.startPrank(trader);
        market.placeBid(id, 30_000e6);
        market.placeBid(id, 20_000e6);
        vm.stopPrank();
        assertEq(usdg.balanceOf(address(market)), 20_000e6);
        assertEq(usdg.balanceOf(trader), 80_000e6);
    }

    // --- transfer rules ------------------------------------------------------------------

    function test_cannotTransferToExporterOrBuyer() public {
        _releaseTwo();
        vm.startPrank(financier);
        vm.expectRevert(IFinancingController.InvalidCounterparty.selector);
        IPositionTransfer(address(controller)).transferPosition(id, exporter);
        vm.expectRevert(IFinancingController.InvalidCounterparty.selector);
        IPositionTransfer(address(controller)).transferPosition(id, buyer);
        vm.stopPrank();
    }

    function test_notTradeableWhileDisputedOrBeforeFunding() public {
        _releaseTwo();
        vm.prank(exporter);
        controller.openDispute(id, keccak256("dispute"));
        vm.prank(financier);
        vm.expectRevert(IPositionTransfer.PositionNotTransferable.selector);
        IPositionTransfer(address(controller)).transferPosition(id, trader);
        assertEq(market.markPrice(id), 0);
    }

    function test_strangerCannotTransfer() public {
        _releaseTwo();
        vm.prank(stranger);
        vm.expectRevert(IPositionTransfer.NotPositionHolder.selector);
        IPositionTransfer(address(controller)).transferPosition(id, stranger);
    }
}
