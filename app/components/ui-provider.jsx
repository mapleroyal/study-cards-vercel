import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mount once around the app so portals inherit the document's appearance tokens
// and notifications work from any route without screen-specific setup.
export function UiProvider({ children }) {
  return (
    <TooltipProvider>
      <Toaster>{children}</Toaster>
    </TooltipProvider>
  );
}
