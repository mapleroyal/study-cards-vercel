import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Collapsible({ ...props }) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ className, render, ...props }) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      render={render}
      className={cn(!render && buttonVariants({ variant: "ghost" }), className)}
      {...props}
    />
  );
}

function CollapsibleContent({ ...props }) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
