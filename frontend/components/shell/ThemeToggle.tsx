"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { toggle } = useTheme();
  // Icons are CSS-driven off the `.dark` class on <html> (set by the no-flash
  // script before hydration), so the visible icon never mismatches on SSR.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      title="Toggle theme"
      className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
    >
      <Moon className="h-3.5 w-3.5 dark:hidden" />
      <Sun className="hidden h-3.5 w-3.5 dark:block" />
    </button>
  );
}
