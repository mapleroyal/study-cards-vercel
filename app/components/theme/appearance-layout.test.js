import { describe, expect, it } from "vitest";

import { resolveAppearanceLayout } from "./appearance-layout";

describe("resolveAppearanceLayout", () => {
  it("uses the expanded control when its measured width plus safety gap fits", () => {
    expect(
      resolveAppearanceLayout({ availableWidth: 113, expandedWidth: 112 }),
    ).toBe("expanded");
    expect(
      resolveAppearanceLayout({ availableWidth: 136.5, expandedWidth: 112.25 }),
    ).toBe("expanded");
  });

  it("uses the compact control below the measured threshold", () => {
    expect(
      resolveAppearanceLayout({ availableWidth: 112.99, expandedWidth: 112 }),
    ).toBe("compact");
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    "defaults to compact while measurements are invalid (%s)",
    (measurement) => {
      expect(
        resolveAppearanceLayout({
          availableWidth: measurement,
          expandedWidth: 112,
        }),
      ).toBe("compact");
      expect(
        resolveAppearanceLayout({
          availableWidth: 160,
          expandedWidth: measurement,
        }),
      ).toBe("compact");
    },
  );
});
