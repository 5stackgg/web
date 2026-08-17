import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Canonical shadcn-vue class merge helper. Committed as a real module so
// `@/lib/utils` resolves deterministically — the shadcn-nuxt auto-generated
// virtual template can get dropped during Vite dep re-optimization, which
// surfaces as a runtime "cn is not a function" in TooltipContent etc.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
