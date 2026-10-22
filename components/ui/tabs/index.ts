import type { InjectionKey, Ref } from "vue"

export { default as Tabs } from "./Tabs.vue"
export { default as TabsContent } from "./TabsContent.vue"
export { default as TabsList } from "./TabsList.vue"
export { default as TabsTrigger } from "./TabsTrigger.vue"

export type TabsListVariant = "default" | "underline" | "track"

// TabsList hands its variant to the triggers inside it.
export const tabsListVariantKey: InjectionKey<Ref<TabsListVariant>> =
  Symbol("TabsListVariant")
