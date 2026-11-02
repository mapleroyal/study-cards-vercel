import { useEffect } from "react";

import { registerAppCorners } from "@/lib/app-corners";

export function AppCorners() {
  useEffect(() => {
    registerAppCorners();
  }, []);

  return null;
}
