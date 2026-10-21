import type { ComputedRef, InjectionKey, Ref } from "vue";
import type { FaqPart } from "~/composables/useFaq";

export type FaqContext = {
  outline: ComputedRef<FaqPart[]>;
  only: Ref<string | null>;
  go: (anchor: string) => void;
};

export const FAQ_CONTEXT: InjectionKey<FaqContext> = Symbol("faq");
