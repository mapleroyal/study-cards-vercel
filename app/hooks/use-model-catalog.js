import * as React from "react";
import { apiRequest } from "@/lib/runtime-client";

export function useModelCatalog() {
  const [models, setModels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [version, refresh] = React.useReducer((value) => value + 1, 0);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiRequest("/api/models")
      .then((result) => {
        if (active) {
          setModels(result.models);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [version]);
  return { models, loading, error, refresh };
}
