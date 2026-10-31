import { AppearanceModeControl } from "@/components/theme/appearance-mode-control";
import { isTheme, useAppStore } from "@/stores/use-app-store";

export function ThemeModeSwitcher({ className }) {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  return (
    <AppearanceModeControl
      className={className}
      value={theme}
      onValueChange={(value) => {
        if (isTheme(value)) {
          setTheme(value);
        }
      }}
    />
  );
}
