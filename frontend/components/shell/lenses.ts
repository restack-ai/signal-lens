import { Activity, Bell, Globe2, Search, Telescope, type LucideIcon } from "lucide-react";

export type LensId = "overview" | "asset" | "feed" | "investigations" | "alerts";

export type LensDef = {
  id: LensId;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Hidden from the nav rail (reached by selecting an asset). */
  contextual?: boolean;
};

export const LENSES: LensDef[] = [
  { id: "overview", label: "Risk Map", short: "MAP", icon: Globe2 },
  { id: "feed", label: "Live Feed", short: "FEED", icon: Activity },
  { id: "investigations", label: "Investigations", short: "INV", icon: Telescope },
  { id: "alerts", label: "Alerts", short: "ALR", icon: Bell },
  { id: "asset", label: "Asset Lens", short: "ASSET", icon: Search, contextual: true },
];
