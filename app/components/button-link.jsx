import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Navigation keeps native link semantics; Base UI Button is for actions.
export function ButtonLink({
  variant = "default",
  size = "default",
  className,
  ...props
}) {
  return (
    <Link
      data-slot="button-link"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
