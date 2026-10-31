import * as React from "react";

export const INITIAL_STEPPER_REPEAT_DELAY_MS = 240;
export const MINIMUM_STEPPER_REPEAT_DELAY_MS = 80;

const STEPPER_REPEAT_ACCELERATION_FACTOR = 0.82;
const CLICK_SUPPRESSION_RESET_DELAY_MS = 350;

export function getNextStepperRepeatDelay(delayMs) {
  return Math.max(
    MINIMUM_STEPPER_REPEAT_DELAY_MS,
    Math.round(delayMs * STEPPER_REPEAT_ACCELERATION_FACTOR),
  );
}

export function useStepperRepeatHandlers(onStep, { disabled = false } = {}) {
  const stepRef = React.useRef(onStep);
  const repeatTimeoutRef = React.useRef(null);
  const suppressClickResetTimeoutRef = React.useRef(null);
  const isPressingRef = React.useRef(false);
  const shouldSuppressClickRef = React.useRef(false);

  stepRef.current = onStep;

  const clearScheduledRepeat = React.useCallback(() => {
    if (repeatTimeoutRef.current === null) {
      return;
    }

    globalThis.clearTimeout(repeatTimeoutRef.current);
    repeatTimeoutRef.current = null;
  }, []);

  const clearClickSuppressionReset = React.useCallback(() => {
    if (suppressClickResetTimeoutRef.current === null) {
      return;
    }

    globalThis.clearTimeout(suppressClickResetTimeoutRef.current);
    suppressClickResetTimeoutRef.current = null;
  }, []);

  const handleStep = React.useCallback(() => {
    if (disabled) {
      return;
    }

    stepRef.current();
  }, [disabled]);

  const scheduleNextStep = React.useCallback(
    (delayMs) => {
      clearScheduledRepeat();
      repeatTimeoutRef.current = globalThis.setTimeout(() => {
        if (!isPressingRef.current || disabled) {
          return;
        }

        handleStep();
        scheduleNextStep(getNextStepperRepeatDelay(delayMs));
      }, delayMs);
    },
    [clearScheduledRepeat, disabled, handleStep],
  );

  const handlePressStart = React.useCallback(
    (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      if (disabled) {
        return;
      }

      clearClickSuppressionReset();
      shouldSuppressClickRef.current = true;
      isPressingRef.current = true;
      handleStep();
      scheduleNextStep(INITIAL_STEPPER_REPEAT_DELAY_MS);
    },
    [clearClickSuppressionReset, disabled, handleStep, scheduleNextStep],
  );

  const handlePressEnd = React.useCallback(() => {
    isPressingRef.current = false;
    clearScheduledRepeat();
    clearClickSuppressionReset();
    suppressClickResetTimeoutRef.current = globalThis.setTimeout(() => {
      shouldSuppressClickRef.current = false;
      suppressClickResetTimeoutRef.current = null;
    }, CLICK_SUPPRESSION_RESET_DELAY_MS);
  }, [clearClickSuppressionReset, clearScheduledRepeat]);

  const handleClick = React.useCallback(() => {
    clearClickSuppressionReset();

    if (shouldSuppressClickRef.current) {
      shouldSuppressClickRef.current = false;
      return;
    }

    handleStep();
  }, [clearClickSuppressionReset, handleStep]);

  React.useEffect(() => {
    if (disabled) {
      isPressingRef.current = false;
      clearScheduledRepeat();
      clearClickSuppressionReset();
      shouldSuppressClickRef.current = false;
    }
  }, [clearClickSuppressionReset, clearScheduledRepeat, disabled]);

  React.useEffect(() => {
    return () => {
      clearScheduledRepeat();
      clearClickSuppressionReset();
    };
  }, [clearClickSuppressionReset, clearScheduledRepeat]);

  return {
    onClick: handleClick,
    onPointerCancel: handlePressEnd,
    onPointerDown: handlePressStart,
    onPointerLeave: handlePressEnd,
    onPointerUp: handlePressEnd,
  };
}
