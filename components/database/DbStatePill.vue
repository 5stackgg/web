<script setup lang="ts">
defineProps<{ state: string | null | undefined }>();
</script>

<template>
  <span
    class="inline-flex h-5 items-center whitespace-nowrap rounded-[5px] border px-1.5 text-[11px] font-semibold"
    :class="
      state === 'active'
        ? 'border-info/30 bg-info/10 text-info'
        : state === 'idle in transaction'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border-border bg-[hsl(240_4%_10%)] text-muted-foreground'
    "
  >
    {{
      state === "idle in transaction"
        ? $t("pages.database.explorer.idle_in_txn")
        : state && state !== "null"
          ? state
          : "—"
    }}
  </span>
</template>
