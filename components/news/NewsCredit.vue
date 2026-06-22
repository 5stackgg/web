<script setup lang="ts">
import { ExternalLink } from "lucide-vue-next";

const TLDR_LOGO_DARK =
  "https://shop.readtldr.gg/cdn/shop/files/White.svg?v=1679007511&width=120";
const TLDR_LOGO_LIGHT =
  "https://shop.readtldr.gg/cdn/shop/files/Black.svg?v=1679007511&width=120";
</script>

<template>
  <div class="flex items-center gap-2 text-sm text-muted-foreground">
    <span class="hidden whitespace-nowrap sm:inline">
      {{ $t("pages.news.powered_by") }}
    </span>
    <a
      href="https://readtldr.gg"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center hover:opacity-80"
      aria-label="tl;dr"
    >
      <img
        :src="TLDR_LOGO_LIGHT"
        alt="tl;dr"
        class="h-4 w-auto dark:hidden"
        loading="lazy"
      />
      <img
        :src="TLDR_LOGO_DARK"
        alt="tl;dr"
        class="hidden h-4 w-auto dark:block"
        loading="lazy"
      />
    </a>
    <span aria-hidden="true" class="text-muted-foreground/40">·</span>
    <a
      href="https://shop.readtldr.gg"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline"
    >
      {{ $t("pages.news.shop") }}
      <ExternalLink class="h-3 w-3" />
    </a>
  </div>
</template>
