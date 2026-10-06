<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { ExternalLink, Pin, PinOff, Settings2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import ClipBoard from "~/components/ClipBoard.vue";
import type { PublicServerView } from "~/components/public-servers/types";

const props = withDefaults(
  defineProps<{
    server: PublicServerView;
    size?: "lg" | "md" | "sm";
    manageTo?: string;
    canFeature?: boolean;
  }>(),
  { size: "md", manageTo: undefined, canFeature: false },
);

const emit = defineEmits<{ toggleFeatured: [] }>();

// Steam takes a moment to hand the link to the game; hold the spinner the
// way QuickServerConnect does so a second click does not fire a second launch.
const launching = ref(false);
let launchTimer: ReturnType<typeof setTimeout> | undefined;
function launch() {
  launching.value = true;
  clearTimeout(launchTimer);
  launchTimer = setTimeout(() => (launching.value = false), 10000);
}
onBeforeUnmount(() => clearTimeout(launchTimer));

const sizeClasses = computed(
  () =>
    ({
      lg: { join: "h-11 min-w-36 px-5 text-[0.8rem]", icon: "h-11 w-11" },
      md: { join: "h-9 w-28 text-xs", icon: "h-9 w-9" },
      sm: { join: "h-8 w-full text-[0.72rem]", icon: "h-8 w-8" },
    })[props.size],
);

// Amber is the one loud thing on the page, so it is spent only on a server
// you can walk straight into.
const quiet = computed(() => props.server.hibernating || props.server.isFull);
</script>

<template>
  <div class="relative z-[2] flex items-center gap-2">
    <ClipBoard
      v-if="server.connection_string"
      :data="server.connection_string"
      :class="['shrink-0', sizeClasses.icon]"
      :title="$t('pages.public_servers.copy_connect')"
      :aria-label="$t('pages.public_servers.copy_connect')"
    />

    <!-- A phone cannot launch CS2, so touch devices keep the copy and lose
         the join. -->
    <div
      v-if="server.connection_link"
      :class="[
        'min-w-0 [@media(pointer:coarse)]:hidden',
        size === 'sm' ? 'flex-1' : '',
      ]"
    >
      <Button
        v-if="server.isFull"
        variant="outline"
        disabled
        :class="['font-semibold', sizeClasses.join]"
      >
        {{ $t("pages.public_servers.full") }}
      </Button>
      <a
        v-else
        :href="server.connection_link"
        class="block"
        tabindex="-1"
        @click="launch"
      >
        <Button
          :variant="quiet ? 'outline' : 'default'"
          :loading="launching"
          :class="[
            'gap-1.5 font-semibold',
            sizeClasses.join,
            quiet
              ? 'group-hover:border-[hsl(var(--tac-amber))] group-hover:text-[hsl(var(--tac-amber))]'
              : 'bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]',
          ]"
        >
          <ExternalLink v-if="size === 'lg'" class="h-4 w-4" />
          {{
            server.hibernating
              ? $t("pages.public_servers.wake_and_join")
              : $t("pages.public_servers.join")
          }}
        </Button>
      </a>
    </div>

    <Button
      v-if="canFeature"
      variant="outline"
      size="icon"
      :class="[
        'shrink-0',
        sizeClasses.icon,
        size === 'lg' ? 'ml-auto' : '',
        server.featured ? 'text-[hsl(var(--tac-amber))]' : '',
      ]"
      :title="
        server.featured
          ? $t('pages.public_servers.unfeature')
          : $t('pages.public_servers.feature')
      "
      :aria-label="
        server.featured
          ? $t('pages.public_servers.unfeature')
          : $t('pages.public_servers.feature')
      "
      :aria-pressed="server.featured ? 'true' : 'false'"
      @click="emit('toggleFeatured')"
    >
      <PinOff v-if="server.featured" class="h-4 w-4" />
      <Pin v-else class="h-4 w-4" />
    </Button>

    <Button
      v-if="manageTo"
      as-child
      variant="outline"
      size="icon"
      :class="[
        'shrink-0',
        sizeClasses.icon,
        size === 'lg' && !canFeature ? 'ml-auto' : '',
      ]"
      :title="$t('pages.public_servers.manage')"
    >
      <NuxtLink :to="manageTo" :aria-label="$t('pages.public_servers.manage')">
        <Settings2 class="h-4 w-4" />
      </NuxtLink>
    </Button>
  </div>
</template>
