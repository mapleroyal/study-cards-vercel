import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrangeByNumbersOneNineIcon,
  CheckListIcon,
  ConnectIcon,
  InputTextIcon,
  PencilEdit02Icon,
  RadioButtonIcon,
  ToggleOnIcon,
} from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { humanizeType } from "@/lib/study-sets";

const questionTypeIcons = {
  true_false: ToggleOnIcon,
  multiple_choice: RadioButtonIcon,
  multiple_response: CheckListIcon,
  fill_in_the_blank: InputTextIcon,
  ordering: ArrangeByNumbersOneNineIcon,
  matching: ConnectIcon,
  short_answer: PencilEdit02Icon,
};

export function QuestionTypeLabel({ className, type, ...props }) {
  const Icon = questionTypeIcons[type];

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 text-label-md text-muted-foreground",
        className,
      )}
      {...props}
    >
      {Icon && (
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4 shrink-0"
          icon={Icon}
          strokeWidth={1.5}
        />
      )}
      <span>{humanizeType(type)}</span>
    </span>
  );
}
