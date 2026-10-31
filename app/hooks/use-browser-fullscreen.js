import * as React from "react";

const FULLSCREEN_CHANGE_EVENTS = [
  "fullscreenchange",
  "webkitfullscreenchange",
  "mozfullscreenchange",
  "MSFullscreenChange",
];

const requestFullscreenNames = [
  "requestFullscreen",
  "webkitRequestFullscreen",
  "webkitRequestFullScreen",
  "mozRequestFullScreen",
  "msRequestFullscreen",
];

const exitFullscreenNames = [
  "exitFullscreen",
  "webkitExitFullscreen",
  "webkitCancelFullScreen",
  "mozCancelFullScreen",
  "msExitFullscreen",
];

export function getFullscreenElement(documentRef) {
  return (
    documentRef?.fullscreenElement ??
    documentRef?.webkitFullscreenElement ??
    documentRef?.webkitCurrentFullScreenElement ??
    documentRef?.mozFullScreenElement ??
    documentRef?.msFullscreenElement ??
    null
  );
}

export function getFullscreenTarget(documentRef) {
  return documentRef?.documentElement ?? null;
}

function getMethodOwnerMethod(owner, methodNames) {
  if (!owner) {
    return null;
  }

  const methodName = methodNames.find(
    (name) => typeof owner[name] === "function",
  );

  if (!methodName) {
    return null;
  }

  return {
    name: methodName,
    call: owner[methodName].bind(owner),
  };
}

export function isBrowserFullscreenSupported(
  documentRef,
  elementRef = getFullscreenTarget(documentRef),
) {
  const canFullscreen =
    documentRef?.fullscreenEnabled ??
    documentRef?.webkitFullscreenEnabled ??
    documentRef?.mozFullScreenEnabled ??
    documentRef?.msFullscreenEnabled ??
    true;

  return Boolean(
    canFullscreen &&
    getMethodOwnerMethod(elementRef, requestFullscreenNames) &&
    getMethodOwnerMethod(documentRef, exitFullscreenNames),
  );
}

export async function requestBrowserFullscreen(elementRef) {
  const requestFullscreen = getMethodOwnerMethod(
    elementRef,
    requestFullscreenNames,
  );

  if (!requestFullscreen) {
    return false;
  }

  if (requestFullscreen.name === "requestFullscreen") {
    await requestFullscreen.call({ navigationUI: "hide" });
    return true;
  }

  await requestFullscreen.call();
  return true;
}

export async function exitBrowserFullscreen(documentRef) {
  const exitFullscreen = getMethodOwnerMethod(documentRef, exitFullscreenNames);

  if (!exitFullscreen) {
    return false;
  }

  await exitFullscreen.call();
  return true;
}

export function useBrowserFullscreen() {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isSupported, setIsSupported] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(Boolean(getFullscreenElement(document)));
      setIsSupported(isBrowserFullscreenSupported(document));
    }

    syncFullscreenState();

    FULLSCREEN_CHANGE_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, syncFullscreenState);
    });

    return () => {
      FULLSCREEN_CHANGE_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, syncFullscreenState);
      });
    };
  }, []);

  async function toggleFullscreen() {
    if (isPending) {
      return false;
    }

    const targetElement = getFullscreenTarget(document);

    if (!isBrowserFullscreenSupported(document)) {
      setIsSupported(false);
      return false;
    }

    setIsPending(true);

    try {
      if (getFullscreenElement(document)) {
        return await exitBrowserFullscreen(document);
      }

      return await requestBrowserFullscreen(targetElement);
    } catch {
      return false;
    } finally {
      setIsPending(false);
      setIsFullscreen(Boolean(getFullscreenElement(document)));
    }
  }

  return {
    isFullscreen,
    isPending,
    isSupported,
    toggleFullscreen,
  };
}
