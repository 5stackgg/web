<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, Trash2, Upload, ShieldCheck } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { toast } from "~/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { useBroadcastHuds } from "~/composables/useBroadcastHuds";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const { t } = useI18n();
// The api is its own origin; a bare /api/... path would hit the panel.
const apiDomain = useRuntimeConfig().public.apiDomain;

const { huds, loading, refresh } = useBroadcastHuds();
const applicationSettings = useApplicationSettingsStore();

const uploading = ref(false);
const busySlug = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  void refresh();
});

const activeSlug = computed(() => applicationSettings.defaultBroadcastHud);

const hudLabel = (hud: { name?: string | null; slug: string }) =>
  hud.name?.trim() || hud.slug;

// The importer is an api route rather than a Hasura mutation: it takes the
// archive itself, and GraphQL is the wrong shape for a multipart body.
async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Clear immediately so choosing the same file twice still fires a change.
  input.value = "";
  if (!file) {
    return;
  }

  uploading.value = true;
  try {
    const form = new FormData();
    form.append("hud", file);

    const response = await fetch(`https://${apiDomain}/huds/import`, {
      method: "POST",
      body: form,
      credentials: "include",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || `import failed (${response.status})`);
    }

    await refresh();
    toast({
      title: t("pages.settings.application.broadcast_huds.imported"),
    });
  } catch (error) {
    toast({
      title: t("pages.settings.application.broadcast_huds.import_failed"),
      description: (error as Error)?.message,
      variant: "destructive",
    });
  } finally {
    uploading.value = false;
  }
}

// The default is a plain setting row, so this is an ordinary upsert rather than
// anything the HUD library owns.
async function makeDefault(slug: string) {
  busySlug.value = slug;
  try {
    // Reached inline rather than destructured at the top of <script setup>:
    // a top-level `$apollo` binding lands in setupState, and vue-apollo's
    // options mixin then cannot assign `this.$apollo` in beforeCreate --
    // Vue refuses to let the Options API mutate a <script setup> binding, and
    // the proxy set trap returning false throws.
    await useNuxtApp().$apollo.defaultClient.mutate({
      mutation: generateMutation({
        insert_settings: [
          {
            objects: [{ name: "public.default_broadcast_hud", value: slug }],
            on_conflict: {
              constraint: settings_constraint.settings_pkey,
              update_columns: [settings_update_column.value],
            },
          },
          { affected_rows: true },
        ],
      }),
    });
    toast({
      title: t("pages.settings.application.broadcast_huds.default_set"),
    });
  } catch (error) {
    toast({
      title: t("pages.settings.application.broadcast_huds.default_failed"),
      description: (error as Error)?.message,
      variant: "destructive",
    });
  } finally {
    busySlug.value = null;
  }
}

async function remove(slug: string) {
  busySlug.value = slug;
  try {
    const response = await fetch(`https://${apiDomain}/huds/${slug}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || `delete failed (${response.status})`);
    }
    await refresh();
    toast({ title: t("pages.settings.application.broadcast_huds.removed") });
  } catch (error) {
    toast({
      title: t("pages.settings.application.broadcast_huds.remove_failed"),
      description: (error as Error)?.message,
      variant: "destructive",
    });
  } finally {
    busySlug.value = null;
  }
}
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <SettingsSection
        :title="$t('pages.settings.application.broadcast_huds.title')"
        :description="
          $t('pages.settings.application.broadcast_huds.description')
        "
      >
        <div class="flex items-center gap-3">
          <input
            ref="fileInput"
            type="file"
            accept=".zip,application/zip"
            class="hidden"
            @change="onFileChosen"
          />
          <Button
            :disabled="uploading"
            @click="fileInput?.click()"
          >
            <Spinner v-if="uploading" class="mr-2 h-4 w-4" />
            <Upload v-else class="mr-2 h-4 w-4" />
            {{ $t("pages.settings.application.broadcast_huds.import") }}
          </Button>
          <p class="text-sm text-muted-foreground">
            {{ $t("pages.settings.application.broadcast_huds.import_hint") }}
          </p>
        </div>

        <div v-if="loading && huds.length === 0" class="flex justify-center p-8">
          <Spinner />
        </div>

        <div v-else class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="hud in huds"
            :key="hud.slug"
            class="flex gap-3 rounded-lg border p-3"
            :class="
              hud.slug === activeSlug
                ? 'border-[hsl(var(--tac-amber))]/40 bg-card/60'
                : 'border-border/60 bg-card/30'
            "
          >
            <img
              v-if="hud.thumbnail"
              :src="hud.thumbnail"
              alt=""
              class="h-16 w-28 shrink-0 rounded object-cover"
            />
            <div
              v-else
              class="h-16 w-28 shrink-0 rounded bg-muted/40"
              aria-hidden="true"
            />

            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">{{ hudLabel(hud) }}</span>
                <ShieldCheck
                  v-if="hud.is_signed"
                  class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
                  :aria-label="
                    $t('pages.settings.application.broadcast_huds.signed')
                  "
                />
              </div>

              <p class="truncate text-xs text-muted-foreground">
                <template v-if="hud.author">{{ hud.author }}</template>
                <template v-if="hud.author && hud.version"> · </template>
                <template v-if="hud.version">v{{ hud.version }}</template>
              </p>

              <div class="mt-auto flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  :disabled="busySlug === hud.slug || hud.slug === activeSlug"
                  @click="makeDefault(hud.slug)"
                >
                  <Check
                    v-if="hud.slug === activeSlug"
                    class="mr-1 h-3.5 w-3.5"
                  />
                  {{
                    hud.slug === activeSlug
                      ? $t("pages.settings.application.broadcast_huds.is_default")
                      : $t("pages.settings.application.broadcast_huds.make_default")
                  }}
                </Button>

                <!-- Builtins ship inside the game-streamer image; there is no
                     archive to remove and they are what the pod falls back to. -->
                <Button
                  v-if="hud.source === 'imported'"
                  size="sm"
                  variant="ghost"
                  :disabled="busySlug === hud.slug"
                  @click="remove(hud.slug)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>
    </PageTransition>
  </SettingsPage>
</template>
