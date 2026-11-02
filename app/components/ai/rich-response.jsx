import { lazy, Suspense } from "react";
import { AiResponse } from "./response";

const RichResponseContent = lazy(() => import("./rich-response-content"));

/** Opt-in: math, diagrams and CJK load only when this renderer is mounted. */
export function AiRichResponse(props) {
  return (
    <Suspense fallback={<AiResponse {...props} />}>
      <RichResponseContent {...props} />
    </Suspense>
  );
}
