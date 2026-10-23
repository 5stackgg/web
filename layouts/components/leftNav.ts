import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface LeftNavItem {
  // Stable across renders and languages: it is what a pin remembers.
  key: string;
  label: string;
  icon: Component;
  to?: RouteLocationRaw;
  href?: string;
  active?: boolean;
  badge?: number;
  badgeTone?: "amber" | "live";
  warning?: string | null;
}

export interface LeftNavSectionData {
  id: string;
  label: string;
  icon: Component;
  items: LeftNavItem[];
  // One short line beside the name, kept while the section is folded.
  live?: { text: string; tone?: "live" } | null;
}
