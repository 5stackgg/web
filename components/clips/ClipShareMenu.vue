<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Check, Download, Link2, Share2 } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { backClosesMenus, useBackDismiss } from "~/composables/useBackDismiss";

// The one Share button a clip carries in its player's tray, on highlights and
// lineups alike: copy the link, download the file, and whatever the surface
// adds below (the highlight modal's admin section).
const props = withDefaults(
  defineProps<{
    copied: boolean;
    copyLabel?: string | null;
    downloadHref?: string | null;
    downloadName?: string | null;
    downloadLabel?: string | null;
    sizeLabel?: string | null;
    contentClass?: string | null;
    // On a page that gives Back to what is open over it, Back closes this
    // menu first. Off where the page runs its own history, as the highlight
    // modal does.
    dismissOnBack?: boolean;
  }>(),
  {
    copyLabel: null,
    downloadHref: null,
    downloadName: null,
    downloadLabel: null,
    sizeLabel: null,
    contentClass: null,
    dismissOnBack: false,
  },
);

const open = defineModel<boolean>("open", { default: false });

useBackDismiss(
  () => open.value,
  () => (open.value = false),
  { enabled: () => props.dismissOnBack && backClosesMenus() },
);

const emit = defineEmits<{ (e: "copy"): void }>();

// Where useClipShare hands the link to the OS share sheet, say so.
const native = ref(false);
onMounted(() => {
  native.value =
    !!window.matchMedia?.("(pointer: coarse)").matches &&
    typeof navigator.share === "function";
});

// Stays open, so the item can show the link was copied.
function onCopy(event: Event) {
  event.preventDefault();
  emit("copy");
}

// Closing on Download would, where Back closes this menu, step back in the
// history while the download is still starting -- which can cancel it.
function keepOpen(event: Event) {
  event.preventDefault();
}
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-black/70 pl-2.5 pr-3 text-xs font-medium text-white/85 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] data-[state=open]:border-[hsl(var(--tac-amber)/0.55)] data-[state=open]:text-[hsl(var(--tac-amber))]"
        @click.stop
      >
        <Share2 class="h-3.5 w-3.5" />
        {{ $t("clips.share_menu.button") }}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      :side-offset="8"
      :class="[
        'w-[17rem] rounded-xl border-white/[0.12] bg-[#232327] p-1.5 [&_[role=separator]]:my-1.5 [&_[role=separator]]:bg-white/[0.08]',
        contentClass,
      ]"
    >
      <DropdownMenuItem
        :class="
          copied
            ? 'text-[hsl(var(--tac-amber))] focus:text-[hsl(var(--tac-amber))]'
            : ''
        "
        @select="onCopy"
      >
        <Check v-if="copied" />
        <Link2 v-else />
        {{
          copied
            ? $t("clips.link_copied")
            : native
              ? $t("clips.share_menu.share_native")
              : (copyLabel ?? $t("clips.share_menu.copy_link"))
        }}
      </DropdownMenuItem>
      <DropdownMenuItem v-if="downloadHref" as-child @select="keepOpen">
        <a :href="downloadHref" :download="downloadName ?? ''">
          <Download />
          {{ downloadLabel ?? $t("common.download") }}
          <span
            v-if="sizeLabel"
            class="ml-auto font-mono text-[0.7rem] tabular-nums text-muted-foreground"
          >
            {{ sizeLabel }}
          </span>
        </a>
      </DropdownMenuItem>
      <slot />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
