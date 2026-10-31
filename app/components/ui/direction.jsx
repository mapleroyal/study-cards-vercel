import * as React from "react";
import { Direction } from "radix-ui";
import { DirectionProvider as BaseDirectionProvider } from "@base-ui/react/direction-provider";

function DirectionProvider({ dir, direction, children }) {
  return (
    <Direction.DirectionProvider dir={direction ?? dir}>
      <BaseDirectionProvider direction={direction ?? dir}>
        {children}
      </BaseDirectionProvider>
    </Direction.DirectionProvider>
  );
}

const useDirection = Direction.useDirection;

export { DirectionProvider, useDirection };
