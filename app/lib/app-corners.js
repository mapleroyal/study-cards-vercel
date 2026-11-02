import { registerHyperellipse } from "hyperellipse";

const APP_CORNER_SHAPE = "superellipse(1.5)";
const FOCUS_SURFACE = "[data-app-corner-focus-within]";
// Only component state can invalidate these painted layers. In particular, do
// not observe arbitrary SVG paint attributes or the polyfill's own style writes.
const STATE_ATTRIBUTES = [
  "data-checked",
  "data-unchecked",
  "data-state",
  "data-disabled",
  "data-invalid",
  "data-selected",
  "data-highlighted",
  "data-popup-open",
  "data-open",
  "data-closed",
  "data-active",
  "aria-invalid",
  "aria-expanded",
  "aria-checked",
  "aria-pressed",
  "aria-selected",
  "disabled",
];

let disposeFallback;

export function registerAppCorners({ force = false } = {}) {
  if (
    typeof document === "undefined" ||
    disposeFallback ||
    (!force && window.CSS.supports("corner-shape", APP_CORNER_SHAPE))
  ) {
    return;
  }

  // CSS supplies the pre-JS reduction; applying a second one compounds it.
  document.documentElement.setAttribute("data-app-corners-fallback", "");
  const controller = registerHyperellipse({ pendingRadiusScale: 1, force });
  let frame = 0;
  const refresh = () => {
    if (frame) {
      return;
    }
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      controller.refresh();
    });
  };

  const refreshFocusSurface = (event) => {
    if (
      event.target instanceof window.Element &&
      event.target.closest(FOCUS_SURFACE)
    ) {
      refresh();
    }
  };
  const stateObserver = new window.MutationObserver((records) => {
    if (
      records.some(
        ({ target }) =>
          target instanceof window.Element &&
          (target.matches("[data-slot], [data-app-corner]") ||
            target.closest(FOCUS_SURFACE)),
      )
    ) {
      refresh();
    }
  });
  stateObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: STATE_ATTRIBUTES,
  });
  document.addEventListener("focusin", refreshFocusSurface, true);
  document.addEventListener("focusout", refreshFocusSurface, true);

  disposeFallback = () => {
    stateObserver.disconnect();
    document.removeEventListener("focusin", refreshFocusSurface, true);
    document.removeEventListener("focusout", refreshFocusSurface, true);
    window.cancelAnimationFrame(frame);
    controller.destroy();
    document.documentElement.removeAttribute("data-app-corners-fallback");
    disposeFallback = undefined;
  };
}

// Registration lives for the application lifetime; HMR must release its
// observers before replacing this module rather than adding another engine.
if (import.meta.hot) {
  import.meta.hot.dispose(() => disposeFallback?.());
}
