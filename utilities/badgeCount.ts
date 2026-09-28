export function formatBadgeCount(count: number): string {
  return count > 100 ? "100+" : String(count);
}

export const badgePopTransition = {
  enterActiveClass:
    "[transition:transform_0.3s_cubic-bezier(0.34,1.56,0.64,1),opacity_0.2s_ease]",
  enterFromClass: "scale-0 opacity-0",
  leaveActiveClass: "[transition:transform_0.15s_ease-in,opacity_0.15s_ease-in]",
  leaveToClass: "scale-0 opacity-0",
};
