(() => {
  const script = globalThis.document.currentScript;
  const storageKey = script?.dataset.themeStorageKey;
  const lightThemeColor = script?.dataset.lightThemeColor || "#ffffff";
  const darkThemeColor = script?.dataset.darkThemeColor || "#181818";
  let theme = "system";

  try {
    const storedTheme = storageKey
      ? globalThis.localStorage.getItem(storageKey)
      : null;

    if (storedTheme === "light" || storedTheme === "dark") {
      theme = storedTheme;
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const resolvedTheme = isDark ? "dark" : "light";

  globalThis.document.documentElement.classList.toggle("dark", isDark);
  globalThis.document.documentElement.style.colorScheme = resolvedTheme;
  globalThis.document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? darkThemeColor : lightThemeColor);
})();
