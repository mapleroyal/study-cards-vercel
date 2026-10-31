import type { Config } from "@react-router/dev/config";
export default {
  appDirectory: "app",
  ssr: true,
  // Reader reloads must not need a network manifest lookup while offline.
  routeDiscovery: { mode: "initial" },
  buildDirectory: "build",
  future: { v8_viteEnvironmentApi: true },
} satisfies Config;
