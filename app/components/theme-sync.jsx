import { useLayoutEffect } from "react";

import { getResolvedTheme, useAppStore } from "@/stores/use-app-store";

export const THEME_COLORS = {
  dark: "#181818",
  light: "#ffffff",
};

export function applyThemeToDocument(theme, documentRef = globalThis.document) {
  if (!documentRef?.documentElement) {
    return;
  }

  const resolvedTheme = theme === "dark" ? "dark" : "light";
  const isDark = resolvedTheme === "dark";

  documentRef.documentElement.classList.toggle("dark", isDark);
  documentRef.documentElement.style.colorScheme = resolvedTheme;
  documentRef
    .querySelector?.('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolvedTheme]);
}

export function ThemeSync() {
  const theme = useAppStore((state) => state.theme);

  useLayoutEffect(() => {
    const matchMedia = window.matchMedia?.bind(window);
    const mediaQuery = matchMedia?.("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolvedTheme = getResolvedTheme(theme, matchMedia);

      applyThemeToDocument(resolvedTheme);
    };

    applyTheme();

    if (theme !== "system" || !mediaQuery) {
      return undefined;
    }

    mediaQuery.addEventListener("change", applyTheme);

    return () => {
      mediaQuery.removeEventListener("change", applyTheme);
    };
  }, [theme]);

  return null;
}
