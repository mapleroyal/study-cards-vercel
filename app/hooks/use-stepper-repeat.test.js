import { describe, expect, it } from "vitest";

import {
  getNextStepperRepeatDelay,
  MINIMUM_STEPPER_REPEAT_DELAY_MS,
} from "./use-stepper-repeat";

describe("getNextStepperRepeatDelay", () => {
  it("accelerates each repeat interval", () => {
    expect(getNextStepperRepeatDelay(240)).toBe(197);
    expect(getNextStepperRepeatDelay(197)).toBe(162);
  });

  it("keeps the repeat interval at the minimum speed", () => {
    expect(getNextStepperRepeatDelay(MINIMUM_STEPPER_REPEAT_DELAY_MS)).toBe(
      MINIMUM_STEPPER_REPEAT_DELAY_MS,
    );
    expect(getNextStepperRepeatDelay(40)).toBe(MINIMUM_STEPPER_REPEAT_DELAY_MS);
  });
});
