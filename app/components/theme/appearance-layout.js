export function resolveAppearanceLayout({
  availableWidth,
  expandedWidth,
  safetyGap = 1,
}) {
  if (
    !Number.isFinite(availableWidth) ||
    !Number.isFinite(expandedWidth) ||
    !Number.isFinite(safetyGap) ||
    availableWidth <= 0 ||
    expandedWidth <= 0 ||
    safetyGap < 0
  ) {
    return "compact";
  }

  return availableWidth >= expandedWidth + safetyGap ? "expanded" : "compact";
}
