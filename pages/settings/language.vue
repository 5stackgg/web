<script setup lang="ts">
import { Check, ChevronsUpDown, Languages } from "lucide-vue-next";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

definePageMeta({
  layout: "profile-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <div>
      <h3 class="text-lg font-medium">
        {{ $t("pages.settings.language.title") }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ $t("pages.settings.language.description") }}
      </p>
    </div>
  </PageTransition>
  <Separator />

  <PageTransition :delay="100">
    <div class="grid gap-6"></div>
  </PageTransition>
</template>
