<script setup lang="ts">
import { HardDrive, Settings2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  createButtonClasses,
  listCreateButtonClasses,
} from "~/utilities/tacticalClasses";

// Set up a public server, split with the dedicated servers list for the
// ones already set up. `collapse` drops the label on phones, like the other
// list headers' create buttons.
defineProps<{ collapse?: boolean }>();
</script>

<template>
  <div class="flex shrink-0">
    <Button
      as-child
      size="sm"
      :class="[
        collapse ? listCreateButtonClasses : createButtonClasses,
        'rounded-r-none',
      ]"
    >
      <NuxtLink
        to="/dedicated-servers/create"
        :title="
          collapse ? $t('pages.public_servers.setup_public_server') : undefined
        "
      >
        <Settings2 class="h-4 w-4" />
        <span :class="{ 'max-md:sr-only': collapse }">{{
          $t("pages.public_servers.setup_public_server")
        }}</span>
      </NuxtLink>
    </Button>
    <FiveStackToolTip
      as-child
      side="bottom"
      :delay-duration="120"
      :tap-toggle="false"
    >
      <template #trigger>
        <Button
          as-child
          size="sm"
          :class="[
            createButtonClasses,
            'w-8 rounded-l-none border-l border-[hsl(var(--tac-amber-foreground)/0.35)] px-0 [&_svg]:size-3.5',
          ]"
        >
          <NuxtLink
            to="/dedicated-servers"
            :aria-label="$t('pages.dedicated_servers.title')"
          >
            <HardDrive />
          </NuxtLink>
        </Button>
      </template>
      {{ $t("pages.dedicated_servers.title") }}
    </FiveStackToolTip>
  </div>
</template>
