import { createCn } from "cn/config";

const typeStyles = [
  "text-display-lg",
  "text-display-md",
  "text-display-sm",
  "text-headline-lg",
  "text-headline-md",
  "text-headline-sm",
  "text-title-lg",
  "text-title-md",
  "text-title-sm",
  "text-body-lg",
  "text-body-md",
  "text-body-sm",
  "text-label-lg",
  "text-label-md",
  "text-label-sm",
];

export const cn = createCn({
  extend: {
    classGroups: {
      "type-style": typeStyles,
    },
    conflictingClassGroups: {
      "type-style": ["font-size", "font-weight", "leading", "tracking"],
      "font-size": ["type-style"],
    },
  },
});
