<script setup lang="ts">
import { Copy } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { copyText } from "./dbCopy";

const props = defineProps<{ query: string | null | undefined }>();
const { t } = useI18n();

function copy() {
  if (!props.query) return;
  void copyText(
    props.query,
    t("pages.database.query_copied"),
    t("pages.database.copy_failed"),
  );
}
</script>

<template>
  <div
    v-if="query"
    class="group/q flex min-w-[260px] max-w-[560px] items-start gap-1.5"
  >
    <code
      class="line-clamp-2 min-w-0 flex-1 whitespace-normal break-all font-mono text-[11.5px] leading-normal text-foreground/85"
      :title="query.length > 160 ? query.slice(0, 600) : undefined"
      >{{ query }}</code
    >
    <button
      type="button"
      class="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-55 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/q:opacity-100"
      :aria-label="$t('pages.database.explorer.copy_query')"
      @click.stop="copy"
    >
      <Copy class="h-3 w-3" />
    </button>
  </div>
  <span v-else class="text-muted-foreground/60">—</span>
</template>
