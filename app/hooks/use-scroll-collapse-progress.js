import * as React from "react";

const DEFAULT_TOP_LOCK_THRESHOLD = 0;
const DEFAULT_COLLAPSE_DISTANCE = 72;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getNextScrollCollapseOffset({
  collapsedOffset,
  currentScrollY,
  lastScrollY,
  collapseDistance = DEFAULT_COLLAPSE_DISTANCE,
  topLockThreshold = DEFAULT_TOP_LOCK_THRESHOLD,
}) {
  if (collapseDistance <= 0) {
    return 0;
  }

  // Ignore scroll that happens before the header is allowed to start collapsing.
  const effectiveCurrentScroll = Math.max(currentScrollY - topLockThreshold, 0);
  const effectiveLastScroll = Math.max(lastScrollY - topLockThreshold, 0);
  const scrollDelta = effectiveCurrentScroll - effectiveLastScroll;

  return clamp(collapsedOffset + scrollDelta, 0, collapseDistance);
}

export function getNextScrollCollapseState({
  collapsedOffset,
  currentScrollY,
  lastScrollY,
  collapseDistance = DEFAULT_COLLAPSE_DISTANCE,
  topLockThreshold = DEFAULT_TOP_LOCK_THRESHOLD,
  paused = false,
}) {
  const normalizedCurrentScrollY = Math.max(currentScrollY, 0);

  if (paused) {
    return {
      collapsedOffset,
      lastScrollY: normalizedCurrentScrollY,
    };
  }

  return {
    collapsedOffset: getNextScrollCollapseOffset({
      collapsedOffset,
      currentScrollY: normalizedCurrentScrollY,
      lastScrollY,
      collapseDistance,
      topLockThreshold,
    }),
    lastScrollY: normalizedCurrentScrollY,
  };
}

export function useScrollCollapseProgress({
  collapseDistance = DEFAULT_COLLAPSE_DISTANCE,
  topLockThreshold = DEFAULT_TOP_LOCK_THRESHOLD,
  paused = false,
} = {}) {
  const [collapseProgress, setCollapseProgress] = React.useState(0);
  const collapsedOffsetRef = React.useRef(0);
  const lastScrollYRef = React.useRef(0);
  const pausedRef = React.useRef(paused);

  React.useEffect(() => {
    pausedRef.current = paused;
    lastScrollYRef.current = Math.max(window.scrollY, 0);
  }, [paused]);

  React.useEffect(() => {
    if (collapseDistance <= 0) {
      collapsedOffsetRef.current = 0;
      setCollapseProgress(0);
      return undefined;
    }

    lastScrollYRef.current = Math.max(window.scrollY, 0);
    collapsedOffsetRef.current = clamp(
      collapsedOffsetRef.current || lastScrollYRef.current - topLockThreshold,
      0,
      collapseDistance,
    );
    let frameId = 0;

    setCollapseProgress(collapsedOffsetRef.current / collapseDistance);

    const updateCollapseProgress = () => {
      const currentScrollY = Math.max(window.scrollY, 0);
      const nextState = getNextScrollCollapseState({
        collapsedOffset: collapsedOffsetRef.current,
        currentScrollY,
        lastScrollY: lastScrollYRef.current,
        collapseDistance,
        topLockThreshold,
        paused: pausedRef.current,
      });

      collapsedOffsetRef.current = nextState.collapsedOffset;
      lastScrollYRef.current = nextState.lastScrollY;
      frameId = 0;

      if (!pausedRef.current) {
        setCollapseProgress(collapsedOffsetRef.current / collapseDistance);
      }
    };

    const onScroll = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(updateCollapseProgress);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [collapseDistance, topLockThreshold]);

  return collapseProgress;
}
