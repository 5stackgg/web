<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import { Check, ShieldCheck, Trash2, Upload } from "lucide-vue-next";
import { broadcastHudLabel } from "~/composables/useBroadcastHuds";

definePageMeta({
  middleware: "admin",
});
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
          <Button :loading="uploading" @click="$refs.fileInput.click()">
            <Upload class="mr-2 h-4 w-4" />
            {{ $t("pages.settings.application.broadcast_huds.import") }}
          </Button>
          <p class="text-sm text-muted-foreground">
            {{ $t("pages.settings.application.broadcast_huds.import_hint") }}
          </p>
        </div>

        <div
          v-if="$apollo.queries.huds.loading && huds.length === 0"
          class="flex justify-center p-8"
        >
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
                <span class="truncate font-medium">{{
                  broadcastHudLabel(hud)
                }}</span>
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
                  :disabled="hud.slug === activeSlug"
                  @click="makeDefault(hud.slug)"
                >
                  <Check
                    v-if="hud.slug === activeSlug"
                    class="mr-1 h-3.5 w-3.5"
                  />
                  {{
                    hud.slug === activeSlug
                      ? $t(
                          "pages.settings.application.broadcast_huds.is_default",
                        )
                      : $t(
                          "pages.settings.application.broadcast_huds.make_default",
                        )
                  }}
                </Button>

                <AlertDialog v-if="hud.source === 'imported'">
                  <AlertDialogTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      :title="$t('common.delete')"
                    >
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{{
                        $t(
                          "pages.settings.application.broadcast_huds.delete_title",
                        )
                      }}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {{
                          $t(
                            "pages.settings.application.broadcast_huds.delete_description",
                            { name: broadcastHudLabel(hud) },
                          )
                        }}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{{
                        $t("common.cancel")
                      }}</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        @click="remove(hud.slug)"
                      >
                        {{
                          $t(
                            "pages.settings.application.broadcast_huds.delete_confirm",
                          )
                        }}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import {
  BROADCAST_HUDS_QUERY,
  type BroadcastHud,
} from "~/composables/useBroadcastHuds";

export default {
  data() {
    return {
      huds: [] as Array<BroadcastHud>,
      uploading: false,
      removing: false,
    };
  },
  apollo: {
    huds: {
      query: BROADCAST_HUDS_QUERY,
      update(data: { broadcast_huds: Array<BroadcastHud> }) {
        return data.broadcast_huds;
      },
    },
  },
  computed: {
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    activeSlug() {
      return useApplicationSettingsStore().defaultBroadcastHud;
    },
  },
  methods: {
    async onFileChosen(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = "";
      if (!file || this.uploading) {
        return;
      }

      this.uploading = true;
      try {
        const form = new FormData();
        form.append("hud", file);

        const response = await fetch(`https://${this.apiDomain}/huds/import`, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body?.message || `import failed (${response.status})`,
          );
        }

        await (this as any).$apollo.queries.huds.refetch();
        toast({
          title: this.$t(
            "pages.settings.application.broadcast_huds.imported",
          ) as string,
        });
      } catch (error) {
        toast({
          title: this.$t(
            "pages.settings.application.broadcast_huds.import_failed",
          ) as string,
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        this.uploading = false;
      }
    },
    async makeDefault(slug: string) {
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings_one: [
              {
                object: { name: "public.default_broadcast_hud", value: slug },
                on_conflict: {
                  constraint: settings_constraint.settings_pkey,
                  update_columns: [settings_update_column.value],
                },
              },
              { __typename: true },
            ],
          }),
        });
        toast({
          title: this.$t(
            "pages.settings.application.broadcast_huds.default_set",
          ) as string,
        });
      } catch (error) {
        toast({
          title: this.$t(
            "pages.settings.application.broadcast_huds.default_failed",
          ) as string,
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    },
    async remove(slug: string) {
      if (this.removing) {
        return;
      }

      this.removing = true;
      try {
        const response = await fetch(`https://${this.apiDomain}/huds/${slug}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body?.message || `delete failed (${response.status})`,
          );
        }

        await (this as any).$apollo.queries.huds.refetch();
        toast({
          title: this.$t(
            "pages.settings.application.broadcast_huds.removed",
          ) as string,
        });
      } catch (error) {
        toast({
          title: this.$t(
            "pages.settings.application.broadcast_huds.remove_failed",
          ) as string,
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        this.removing = false;
      }
    },
  },
};
</script>
