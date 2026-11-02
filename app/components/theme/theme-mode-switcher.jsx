import { AppearanceModeControl } from "@/components/theme/appearance-mode-control";
import { useAppStore } from "@/stores/use-app-store";

export function ThemeModeSwitcher(props) {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  return (
    <AppearanceModeControl value={theme} onValueChange={setTheme} {...props} />
  );
}
