<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import {
  ExternalLink,
  Link2,
  Maximize2,
  ShieldCheck,
  Trash2,
} from "lucide-vue-next";
import { broadcastHudLabel } from "~/composables/useBroadcastHuds";
import { vetoTileActiveClasses } from "~/utilities/tacticalClasses";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <SettingsSection
        id="broadcast-huds"
        :title="$t('pages.settings.application.broadcast_huds.title')"
        :description="
          $t('pages.settings.application.broadcast_huds.description')
        "
      >
        <template #action>
          <a
            href="https://cshuds.com"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
          >
            {{
              $t("pages.settings.application.broadcast_huds.get_more", {
                site: "cshuds.com",
              })
            }}
            <ExternalLink class="h-3 w-3" />
          </a>
        </template>

        <input
          ref="fileInput"
          type="file"
          accept=".zip,application/zip"
          class="hidden"
          @change="onFileChosen"
        />

        <div
          v-if="$apollo.queries.huds.loading && huds.length === 0"
          class="grid gap-4 sm:grid-cols-2"
        >
          <Skeleton v-for="n in 2" :key="n" class="h-64 rounded-xl" />
        </div>

        <TransitionGroup
          v-else
          tag="div"
          appear
          enter-from-class="translate-y-2 opacity-0"
          enter-active-class="transition-[opacity,transform] duration-300 ease-out [transition-delay:var(--stagger)]"
          move-class="transition-transform duration-500 ease-out"
          class="grid gap-4 sm:grid-cols-2"
        >
          <div
            v-for="(hud, index) in sortedHuds"
            :key="hud.slug"
            :style="{ '--stagger': `${index * 60}ms` }"
          >
            <article
              class="group/tile relative flex h-full flex-col overflow-hidden rounded-xl border bg-card/40 [backdrop-filter:blur(6px)] transition-[border-color,box-shadow] duration-200"
              :class="
                isDefault(hud)
                  ? vetoTileActiveClasses
                  : 'border-border/70 hover:border-[hsl(var(--tac-amber)/0.45)]'
              "
            >
              <button
                type="button"
                class="group/preview relative block aspect-video w-full cursor-zoom-in overflow-hidden bg-black/70 focus-visible:outline-none"
                :aria-label="
                  $t('pages.settings.application.broadcast_huds.preview', {
                    name: broadcastHudLabel(hud),
                  })
                "
                @click="previewHud = hud"
              >
                <img
                  v-if="screenshot(hud)"
                  :src="screenshot(hud)"
                  alt=""
                  loading="lazy"
                  class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover/tile:scale-[1.04]"
                />
                <template v-else-if="hud.thumbnail">
                  <img
                    :src="hud.thumbnail"
                    alt=""
                    aria-hidden="true"
                    class="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl"
                  />
                  <img
                    :src="hud.thumbnail"
                    alt=""
                    class="relative mx-auto h-full w-auto object-contain p-6 drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-transform duration-700 ease-out group-hover/tile:scale-[1.04]"
                  />
                </template>
                <span
                  v-else
                  class="absolute inset-0 grid place-items-center font-mono text-5xl font-bold tracking-[0.25em] text-muted-foreground/25"
                >
                  {{ monogram(hud) }}
                </span>

                <span
                  class="tac-scanlines pointer-events-none absolute inset-0"
                ></span>
                <span
                  class="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent"
                ></span>

                <span
                  v-if="isDefault(hud)"
                  class="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-black/70 px-2 py-1 font-mono text-[0.6rem] font-semibold uppercase leading-none tracking-[0.2em] text-[hsl(var(--tac-amber))] backdrop-blur-sm"
                >
                  {{ $t("pages.settings.application.broadcast_huds.is_default") }}
                </span>

                <span
                  class="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-sm bg-black/70 px-2 py-1 font-mono text-[0.6rem] uppercase leading-none tracking-[0.18em] text-white/70 backdrop-blur-sm"
                >
                  <ShieldCheck
                    v-if="hud.is_signed"
                    class="h-3 w-3 text-success"
                    :aria-label="
                      $t('pages.settings.application.broadcast_huds.signed')
                    "
                  />
                  {{
                    hud.source === "builtin"
                      ? $t(
                          "pages.settings.application.broadcast_huds.source_builtin",
                        )
                      : $t(
                          "pages.settings.application.broadcast_huds.source_imported",
                        )
                  }}
                </span>

                <span
                  class="absolute bottom-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-md bg-black/70 text-white/80 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover/tile:opacity-100 group-focus-visible/preview:opacity-100"
                >
                  <Maximize2 class="h-3.5 w-3.5" />
                </span>
              </button>

              <div class="flex flex-1 items-center gap-3 p-3.5">
                <div class="min-w-0 flex-1">
                  <h3 class="truncate text-sm font-semibold">
                    {{ broadcastHudLabel(hud) }}
                  </h3>
                  <div
                    v-if="hudMeta(hud) || hud.page_url"
                    class="mt-1 flex min-w-0 items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    <span v-if="hudMeta(hud)" class="truncate">{{
                      hudMeta(hud)
                    }}</span>
                    <a
                      v-if="hud.page_url"
                      :href="hud.page_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex shrink-0 items-center gap-1 transition-colors hover:text-[hsl(var(--tac-amber))]"
                    >
                      {{ pageHost(hud) }}
                      <ExternalLink class="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <p
                    v-else-if="hud.description"
                    class="mt-0.5 truncate text-xs text-muted-foreground"
                  >
                    {{ hud.description }}
                  </p>
                </div>

                <Button
                  v-if="!isDefault(hud)"
                  size="sm"
                  variant="outline"
                  class="shrink-0"
                  @click="makeDefault(hud.slug)"
                >
                  {{
                    $t("pages.settings.application.broadcast_huds.make_default")
                  }}
                </Button>

                <Button
                  v-if="hud.source === 'imported'"
                  variant="ghost"
                  size="icon"
                  class="shrink-0"
                  :title="
                    $t('pages.settings.application.broadcast_huds.set_page_link')
                  "
                  @click="editPage(hud)"
                >
                  <Link2 class="h-4 w-4" />
                </Button>

                <AlertDialog v-if="hud.source === 'imported'">
                  <AlertDialogTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="shrink-0"
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
            </article>
          </div>

          <div
            key="import"
            :style="{ '--stagger': `${sortedHuds.length * 60}ms` }"
          >
            <button
              type="button"
              class="relative flex h-full min-h-64 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed p-6 text-center transition-colors duration-200 disabled:cursor-progress"
              :class="
                dragDepth > 0
                  ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.07)]'
                  : 'border-border/70 bg-card/20 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-card/40'
              "
              :disabled="uploading"
              @click="openPicker"
              @dragenter.prevent="dragDepth++"
              @dragover.prevent
              @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
              @drop.prevent="onDrop"
            >
              <span
                v-if="uploading"
                class="absolute inset-x-0 top-0 h-[2px] overflow-hidden text-[hsl(var(--tac-amber))]"
              >
                <span class="tac-scan-sweep block h-full"></span>
              </span>

              <span
                class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
              >
                {{
                  uploading
                    ? $t("pages.settings.application.broadcast_huds.importing")
                    : $t("pages.settings.application.broadcast_huds.import")
                }}
              </span>
              <span
                class="max-w-full truncate text-xs text-muted-foreground"
              >
                {{
                  uploading
                    ? uploadingName
                    : $t("pages.settings.application.broadcast_huds.drop")
                }}
              </span>
              <span
                v-if="!uploading"
                class="text-[0.7rem] text-muted-foreground/70"
              >
                {{ $t("pages.settings.application.broadcast_huds.import_hint") }}
              </span>
            </button>
          </div>
        </TransitionGroup>

        <Dialog
          :open="!!previewHud"
          @update:open="(open: boolean) => !open && (previewHud = null)"
        >
          <DialogContent
            v-if="previewHud"
            class="max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-xl"
          >
            <div class="relative aspect-video w-full overflow-hidden bg-black">
              <img
                v-if="screenshot(previewHud)"
                :src="screenshot(previewHud)"
                alt=""
                class="absolute inset-0 h-full w-full object-cover"
              />
              <template v-else-if="previewHud.thumbnail">
                <img
                  :src="previewHud.thumbnail"
                  alt=""
                  aria-hidden="true"
                  class="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl"
                />
                <img
                  :src="previewHud.thumbnail"
                  alt=""
                  class="relative mx-auto h-full w-auto object-contain p-10"
                />
              </template>
              <span
                v-else
                class="absolute inset-0 grid place-items-center font-mono text-7xl font-bold tracking-[0.25em] text-muted-foreground/25"
              >
                {{ monogram(previewHud) }}
              </span>
              <span
                class="tac-scanlines pointer-events-none absolute inset-0"
              ></span>
            </div>

            <div class="flex items-center gap-4 border-t p-4">
              <div class="min-w-0 flex-1">
                <DialogTitle class="truncate text-base">
                  {{ broadcastHudLabel(previewHud) }}
                </DialogTitle>
                <DialogDescription class="mt-1 truncate">
                  {{ hudMeta(previewHud) || previewHud.description }}
                </DialogDescription>
              </div>
              <a
                v-if="previewHud.page_url"
                :href="previewHud.page_url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
              >
                {{
                  $t("pages.settings.application.broadcast_huds.view_on", {
                    site: pageHost(previewHud),
                  })
                }}
                <ExternalLink class="h-3 w-3" />
              </a>
              <span
                v-if="isDefault(previewHud)"
                class="inline-flex shrink-0 items-center gap-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
              >
                {{ $t("pages.settings.application.broadcast_huds.is_default") }}
              </span>
              <Button
                v-else
                size="sm"
                class="shrink-0"
                @click="makeDefault(previewHud.slug)"
              >
                {{
                  $t("pages.settings.application.broadcast_huds.make_default")
                }}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          :open="!!linkHud"
          @update:open="(open: boolean) => !open && (linkHud = null)"
        >
          <DialogContent v-if="linkHud" class="max-w-md">
            <form class="grid gap-4" @submit.prevent="savePage">
              <div class="grid gap-1.5">
                <DialogTitle>{{
                  $t("pages.settings.application.broadcast_huds.page_link")
                }}</DialogTitle>
                <DialogDescription>{{
                  $t(
                    "pages.settings.application.broadcast_huds.page_link_description",
                  )
                }}</DialogDescription>
              </div>
              <Input
                v-model="pageUrlDraft"
                type="url"
                inputmode="url"
                placeholder="https://cshuds.com/offer/…"
                autofocus
              />
              <div class="flex justify-end gap-2">
                <Button type="button" variant="ghost" @click="linkHud = null">
                  {{ $t("common.cancel") }}
                </Button>
                <Button type="submit" :loading="savingPage">
                  {{ $t("common.save") }}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </SettingsSection>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import {
  BROADCAST_HUD_LIBRARY_QUERY,
  broadcastHudLabel,
  type BroadcastHudDetails,
} from "~/composables/useBroadcastHuds";

const BUILTIN_PREVIEWS: Record<string, string> = {
  "default-horizontal": "/img/huds/default-horizontal.webp",
  "default-vertical": "/img/huds/default-vertical.webp",
};

export default {
  data() {
    return {
      huds: [] as Array<BroadcastHudDetails>,
      uploading: false,
      uploadingName: "",
      removing: false,
      // dragleave also fires when the pointer crosses into a child, so a
      // depth counter rather than a boolean.
      dragDepth: 0,
      order: [] as Array<string>,
      previewHud: null as BroadcastHudDetails | null,
      linkHud: null as BroadcastHudDetails | null,
      pageUrlDraft: "",
      savingPage: false,
    };
  },
  apollo: {
    huds: {
      query: BROADCAST_HUD_LIBRARY_QUERY,
      update(data: { broadcast_huds: Array<BroadcastHudDetails> }) {
        return data.broadcast_huds;
      },
    },
  },
  watch: {
    // Placed once and then left alone: switching the default must not move
    // tiles, only a new import or a delete changes the order.
    huds: {
      immediate: true,
      handler(huds: Array<BroadcastHudDetails>) {
        const kept = this.order.filter((slug) =>
          huds.some((hud) => hud.slug === slug),
        );
        const added = huds
          .filter((hud) => !kept.includes(hud.slug))
          .sort(
            (a, b) =>
              this.placement(a) - this.placement(b) ||
              broadcastHudLabel(a).localeCompare(broadcastHudLabel(b)),
          )
          .map((hud) => hud.slug);

        this.order = [...kept, ...added];
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
    sortedHuds(): Array<BroadcastHudDetails> {
      return this.order
        .map((slug) => this.huds.find((hud) => hud.slug === slug))
        .filter((hud): hud is BroadcastHudDetails => !!hud);
    },
  },
  methods: {
    placement(hud: BroadcastHudDetails) {
      if (hud.slug === this.activeSlug) {
        return 0;
      }
      return hud.source === "builtin" ? 1 : 2;
    },
    isDefault(hud: BroadcastHudDetails) {
      return hud.slug === this.activeSlug;
    },
    screenshot(hud: BroadcastHudDetails) {
      return (
        hud.preview ??
        (hud.source === "builtin" ? BUILTIN_PREVIEWS[hud.slug] : undefined)
      );
    },
    pageHost(hud: BroadcastHudDetails) {
      try {
        return new URL(hud.page_url as string).hostname.replace(/^www\./, "");
      } catch {
        return hud.page_url;
      }
    },
    editPage(hud: BroadcastHudDetails) {
      this.pageUrlDraft = hud.page_url ?? "";
      this.linkHud = hud;
    },
    async savePage() {
      if (this.savingPage || !this.linkHud) {
        return;
      }

      this.savingPage = true;
      try {
        const response = await fetch(
          `https://${this.apiDomain}/huds/${this.linkHud.slug}/page`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: this.pageUrlDraft.trim() || null }),
            credentials: "include",
          },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.message || `save failed (${response.status})`);
        }

        await (this as any).$apollo.queries.huds.refetch();
        toast({
          title: this.$t(
            body?.previewUpdated
              ? "pages.settings.application.broadcast_huds.page_link_preview_saved"
              : "pages.settings.application.broadcast_huds.page_link_saved",
          ) as string,
        });
        this.linkHud = null;
      } catch (error) {
        toast({
          title: this.$t(
            "pages.settings.application.broadcast_huds.page_link_failed",
          ) as string,
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        this.savingPage = false;
      }
    },
    monogram(hud: BroadcastHudDetails) {
      return broadcastHudLabel(hud)
        .split(/[\s_-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join("");
    },
    hudMeta(hud: BroadcastHudDetails) {
      return [hud.author, hud.version && `v${hud.version}`]
        .filter(Boolean)
        .join(" · ");
    },
    openPicker() {
      if (this.uploading) {
        return;
      }
      (this.$refs.fileInput as HTMLInputElement).click();
    },
    onFileChosen(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = "";
      if (file) {
        this.importFile(file);
      }
    },
    onDrop(event: DragEvent) {
      this.dragDepth = 0;
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        this.importFile(file);
      }
    },
    async importFile(file: File) {
      if (this.uploading) {
        return;
      }

      this.uploading = true;
      this.uploadingName = file.name;
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
        this.uploadingName = "";
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
