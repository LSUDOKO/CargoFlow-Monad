// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CargoNoteMarket} from "../../src/CargoNoteMarket.sol";
import {CargoNoteToken, CargoNoteWrapper} from "../../src/CargoNoteToken.sol";
import {IPositionTransfer} from "../../src/interfaces/IPositionTransfer.sol";
import {ControllerBase} from "./ControllerBase.sol";

contract CargoNoteTokenTest is ControllerBase {
    CargoNoteMarket internal market;
    CargoNoteWrapper internal wrapper;
    address internal alice = makeAddr("alice");

    function setUp() public override {
        super.setUp();
        market = new CargoNoteMarket(address(controller));
        wrapper = new CargoNoteWrapper(address(controller), address(market));
    }

    function _releaseTwo() internal {
        _activate();
        for (uint8 i; i < 2; ++i) {
            _commitEvidence(i, 1, 95, 300);
            vm.prank(exporter);
            controller.evaluateAndReleaseMilestone(id, i, 1);
        }
    }

    function _wrap() internal returns (CargoNoteToken t) {
        vm.startPrank(financier);
        IPositionTransfer(address(controller)).setPositionOperator(id, address(wrapper));
        t = CargoNoteToken(wrapper.wrap(id, "cNOTE-SG01"));
        vm.stopPrank();
    }

    function test_wrapMintsTheClaimAndMovesThePosition() public {
        _releaseTwo();
        uint256 claim = market.claimValue(id);
        CargoNoteToken t = _wrap();
        assertEq(t.totalSupply(), claim);
        assertEq(t.balanceOf(financier), claim);
        assertEq(t.decimals(), 6);
        assertEq(controller.getFacility(id).financier, address(t));
        assertEq(wrapper.tokenOf(id), address(t));
        assertEq(t.previewRedeem(1e6), 0);
    }

    function test_onlyHolderWraps_once() public {
        _releaseTwo();
        vm.prank(stranger);
        vm.expectRevert(CargoNoteWrapper.NotHolder.selector);
        wrapper.wrap(id, "X");
        _wrap();
        vm.prank(financier);
        vm.expectRevert(CargoNoteWrapper.NotHolder.selector); // the token is the holder now
        wrapper.wrap(id, "X");
    }

    function test_settlementIsSharedProRata() public {
        _releaseTwo();
        CargoNoteToken t = _wrap();
        uint256 supply = t.totalSupply();
        vm.prank(financier);
        t.transfer(alice, supply / 4);

        vm.prank(alice);
        vm.expectRevert(CargoNoteToken.NotClosed.selector);
        t.redeem(1);

        for (uint8 i = 2; i < 5; ++i) {
            _commitEvidence(i, 1, 95, 300);
            vm.prank(exporter);
            controller.evaluateAndReleaseMilestone(id, i, 1);
        }
        vm.startPrank(buyer);
        controller.markDelivered(id);
        controller.settle(id);
        vm.stopPrank();

        uint256 paid = COMMITTED + (COMMITTED * uint256(FEE_BPS)) / 10_000;
        assertEq(usdg.balanceOf(address(t)), paid);
        vm.prank(alice);
        uint256 got = t.redeem(supply / 4);
        assertEq(got, paid / 4);
        uint256 rest = t.balanceOf(financier);
        vm.prank(financier);
        t.redeem(rest);
        assertEq(t.totalSupply(), 0);
        assertLe(usdg.balanceOf(address(t)), 1);
    }
}
