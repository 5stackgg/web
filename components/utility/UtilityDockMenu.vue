<script setup lang="ts">
import { ref } from "vue";
import { Ellipsis } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

// The last tile of a view's action row: everything you can do with the thing
// that did not earn a button of its own. Items go in the slot.
//
// A menu trigger inside a tooltip registers its anchor on the tooltip's
// popper, so the menu is handed the button itself or it opens off screen.
const trigger = ref<HTMLElement | null>(null);
</script>

<template>
  <DropdownMenu>
    <FiveStackToolTip
      as-child
      side="bottom"
      :delay-duration="120"
      :tap-toggle="false"
    >
      <template #trigger>
        <DropdownMenuTrigger as-child>
          <button
            ref="trigger"
            type="button"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 data-[state=open]:bg-white/[0.06] data-[state=open]:text-foreground data-[state=open]:!ring-0"
            :aria-label="$t('pages.utility.card.more_actions')"
          >
            <Ellipsis class="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
      </template>
      {{ $t("pages.utility.card.more_actions") }}
    </FiveStackToolTip>
    <DropdownMenuContent
      :reference="trigger ?? undefined"
      side="bottom"
      align="end"
      :side-offset="10"
      class="w-56 rounded-xl border-white/[0.12] bg-[#232327] p-1.5 [&_[role=separator]]:my-1.5 [&_[role=separator]]:bg-white/[0.08]"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
