import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
function Empty({ className, ...props }) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-lg border-dashed p-12 text-center text-balance",
        className,
      )}
      {...props}
    />
  );
}
function EmptyHeader({ className, ...props }) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-2", className)}
      {...props}
    />
  );
}
const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        default: "",
        sm: "[&_svg:not([class*='size-'])]:size-6",
        lg: "mb-3 [&_svg:not([class*='size-'])]:size-16",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);
function EmptyMedia({ className, size = "default", ...props }) {
  return (
    <div
      data-slot="empty-icon"
      data-size={size}
      className={cn(
        emptyMediaVariants({
          size,
          className,
        }),
      )}
      {...props}
    />
  );
}
function EmptyTitle({ className, render, ...props }) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps(
      {
        "data-slot": "empty-title",
        className: cn("text-headline-sm", className),
      },
      props,
    ),
  });
}
function EmptyDescription({ className, ...props }) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-body-md text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className,
      )}
      {...props}
    />
  );
}
function EmptyContent({ className, ...props }) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "text-body-md flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-balance",
        className,
      )}
      {...props}
    />
  );
}
export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
};
