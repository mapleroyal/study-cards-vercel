import { describe, expect, it, vi } from "vitest";

import { applyThemeToDocument, THEME_COLORS } from "./theme-sync";

function createDocumentRef() {
  const themeColorMeta = { setAttribute: vi.fn() };

  return {
    documentRef: {
      documentElement: {
        classList: { toggle: vi.fn() },
        style: {},
      },
      querySelector: vi.fn().mockReturnValue(themeColorMeta),
    },
    themeColorMeta,
  };
}

describe("applyThemeToDocument", () => {
  it("synchronizes the root class, color scheme, and browser chrome", () => {
    const { documentRef, themeColorMeta } = createDocumentRef();

    applyThemeToDocument("dark", documentRef);

    expect(documentRef.documentElement.classList.toggle).toHaveBeenCalledWith(
      "dark",
      true,
    );
    expect(documentRef.documentElement.style.colorScheme).toBe("dark");
    expect(themeColorMeta.setAttribute).toHaveBeenCalledWith(
      "content",
      THEME_COLORS.dark,
    );
  });

  it("falls back to the light theme for an unexpected value", () => {
    const { documentRef, themeColorMeta } = createDocumentRef();

    applyThemeToDocument("unexpected", documentRef);

    expect(documentRef.documentElement.classList.toggle).toHaveBeenCalledWith(
      "dark",
      false,
    );
    expect(documentRef.documentElement.style.colorScheme).toBe("light");
    expect(themeColorMeta.setAttribute).toHaveBeenCalledWith(
      "content",
      THEME_COLORS.light,
    );
  });
});
