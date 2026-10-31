import { describe, expect, it } from "vitest";

import {
  getNextScrollCollapseOffset,
  getNextScrollCollapseState,
} from "./use-scroll-collapse-progress";

describe("getNextScrollCollapseOffset", () => {
  it("ignores scroll movement before the top lock threshold", () => {
    expect(
      getNextScrollCollapseOffset({
        collapsedOffset: 0,
        currentScrollY: 70,
        lastScrollY: 30,
        collapseDistance: 72,
        topLockThreshold: 64,
      }),
    ).toBe(6);
  });

  it("clamps the collapsed offset to the full collapse distance", () => {
    expect(
      getNextScrollCollapseOffset({
        collapsedOffset: 60,
        currentScrollY: 200,
        lastScrollY: 120,
        collapseDistance: 72,
        topLockThreshold: 64,
      }),
    ).toBe(72);
  });

  it("reveals the navbar progressively when scrolling upward", () => {
    expect(
      getNextScrollCollapseOffset({
        collapsedOffset: 72,
        currentScrollY: 170,
        lastScrollY: 200,
        collapseDistance: 72,
        topLockThreshold: 64,
      }),
    ).toBe(42);
  });

  it("fully resets when scrolling back above the top lock threshold", () => {
    expect(
      getNextScrollCollapseOffset({
        collapsedOffset: 6,
        currentScrollY: 50,
        lastScrollY: 70,
        collapseDistance: 72,
        topLockThreshold: 64,
      }),
    ).toBe(0);
  });

  it("preserves the collapsed offset while paused", () => {
    expect(
      getNextScrollCollapseState({
        collapsedOffset: 42,
        currentScrollY: 0,
        lastScrollY: 170,
        collapseDistance: 72,
        paused: true,
      }),
    ).toEqual({
      collapsedOffset: 42,
      lastScrollY: 0,
    });
  });

  it("continues from the latest scroll position after a pause", () => {
    expect(
      getNextScrollCollapseState({
        collapsedOffset: 42,
        currentScrollY: 20,
        lastScrollY: 0,
        collapseDistance: 72,
        paused: false,
      }),
    ).toEqual({
      collapsedOffset: 62,
      lastScrollY: 20,
    });
  });
});
