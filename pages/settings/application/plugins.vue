<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
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
import PluginIcon from "~/components/plugins/PluginIcon.vue";
import PluginIconPicker from "~/components/plugins/PluginIconPicker.vue";
import {
  Pencil,
  Trash2,
  Plus,
  Wand2,
  ChevronDown,
  BookOpen,
  ExternalLink,
  Puzzle,
} from "lucide-vue-next";

const DOCS_URL = "https://docs.5stack.gg/plugins/";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="plugins"
          :title="$t('pages.settings.application.plugins.section')"
          :description="
            $t('pages.settings.application.plugins.description')
          "
          clickable-header
          @header-click="toggleEnabled"
        >
          <template #action>
            <Switch
              :model-value="pluginsEnabled"
              @update:model-value="toggleEnabled"
            />
          </template>

          <div v-if="pluginsEnabled" class="space-y-4">
            <div
              v-if="plugins.length > 0"
              class="flex flex-wrap items-center justify-between gap-3"
            >
              <a
                :href="DOCS_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--tac-amber))] underline-offset-2 hover:underline"
              >
                <BookOpen class="h-4 w-4" />
                {{ $t("pages.settings.application.plugins.docs_link") }}
                <ExternalLink class="h-3.5 w-3.5" />
              </a>
              <Button variant="tactical" size="sm" @click="openCreate">
                <Plus class="h-4 w-4" />
                {{ $t("pages.settings.application.plugins.add") }}
              </Button>
            </div>

            <div
              v-if="plugins.length > 0"
              class="divide-y divide-border/60 rounded-lg border border-border/60"
            >
              <div
                v-for="plugin in plugins"
                :key="plugin.id"
                class="group flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-muted/40"
                @click="openEdit(plugin)"
              >
                <div
                  class="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40"
                  :class="plugin.enabled ? 'text-primary' : 'text-muted-foreground'"
                >
                  <PluginIcon :name="plugin.icon" class="size-5" />
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="truncate font-medium">{{ plugin.title }}</span>
                    <Badge v-if="plugin.is_default" variant="secondary">
                      {{
                        $t(
                          "pages.settings.application.plugins.fields.is_default",
                        )
                      }}
                    </Badge>
                    <Badge v-if="!plugin.enabled" variant="outline">
                      {{ $t("common.disabled") }}
                    </Badge>
                  </div>
                  <div
                    class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground"
                  >
                    <span class="truncate font-mono">/apps/{{ plugin.slug }}</span>
                    <span class="text-border">•</span>
                    <span>
                      {{
                        plugin.required_role
                          ? roleLabel(plugin.required_role)
                          : $t("pages.settings.application.plugins.public")
                      }}
                    </span>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1" @click.stop>
                  <Button
                    variant="ghost"
                    size="icon"
                    :title="$t('common.edit')"
                    @click="openEdit(plugin)"
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <AlertDialog>
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
                          $t("pages.settings.application.plugins.delete_title")
                        }}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {{
                            $t(
                              "pages.settings.application.plugins.delete_description",
                              { title: plugin.title },
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
                          @click="remove(plugin)"
                        >
                          {{
                            $t(
                              "pages.settings.application.plugins.delete_confirm",
                            )
                          }}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>

            <div
              v-else
              class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 p-8 text-center"
            >
              <div
                class="flex size-11 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground"
              >
                <Puzzle class="size-5" />
              </div>
              <div class="space-y-1">
                <p class="font-medium">
                  {{ $t("pages.settings.application.plugins.empty_title") }}
                </p>
                <p class="max-w-prose text-sm text-muted-foreground">
                  {{
                    $t("pages.settings.application.plugins.empty_description")
                  }}
                </p>
              </div>
              <div class="flex flex-wrap items-center justify-center gap-2">
                <Button variant="tactical" size="sm" @click="openCreate">
                  <Plus class="h-4 w-4" />
                  {{ $t("pages.settings.application.plugins.add") }}
                </Button>
                <Button variant="outline" size="sm" as-child>
                  <a :href="DOCS_URL" target="_blank" rel="noopener noreferrer">
                    <BookOpen class="h-4 w-4" />
                    {{ $t("pages.settings.application.plugins.docs_link") }}
                    <ExternalLink class="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </SettingsSection>
      </div>
    </PageTransition>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{
              form.id
                ? $t("pages.settings.application.plugins.edit_title")
                : $t("pages.settings.application.plugins.add_title")
            }}
          </DialogTitle>
          <DialogDescription>
            {{ $t("pages.settings.application.plugins.form_description") }}
            <a
              :href="DOCS_URL"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 font-medium text-[hsl(var(--tac-amber))] underline-offset-2 hover:underline"
            >
              {{ $t("pages.settings.application.plugins.docs_link") }}
              <ExternalLink class="h-3.5 w-3.5" />
            </a>
          </DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="save">
          <div class="space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
            <Label class="flex items-center gap-2">
              <Wand2 class="h-4 w-4 text-primary" />
              {{ $t("pages.settings.application.plugins.detect_label") }}
            </Label>
            <div class="flex gap-2">
              <Input
                v-model="detectUrl"
                placeholder="https://inventory.5stack.gg"
                @keydown.enter.prevent="detect"
              />
              <Button
                type="button"
                variant="outline"
                :loading="detecting"
                :disabled="!detectUrl.trim()"
                @click="detect"
              >
                {{ $t("pages.settings.application.plugins.detect") }}
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.settings.application.plugins.detect_hint") }}
            </p>
            <p v-if="detectError" class="text-xs text-destructive">
              {{ detectError }}
            </p>
          </div>

          <div class="space-y-2">
            <Label>{{
              $t("pages.settings.application.plugins.fields.title")
            }}</Label>
            <Input v-model="form.title" required />
          </div>

          <div class="space-y-2">
            <Label>{{
              $t("pages.settings.application.plugins.fields.icon")
            }}</Label>
            <PluginIconPicker v-model="form.icon" />
          </div>

          <div class="space-y-2">
            <Label>{{
              $t("pages.settings.application.plugins.fields.required_role")
            }}</Label>
            <Select v-model="form.required_role">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="public">
                    {{
                      $t("pages.settings.application.plugins.public")
                    }}
                  </SelectItem>
                  <SelectItem
                    v-for="role in roles"
                    :key="role"
                    :value="role"
                  >
                    {{ roleLabel(role) }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Collapsible v-model:open="showAdvanced" class="rounded-md border">
            <CollapsibleTrigger as-child>
              <button
                type="button"
                class="flex w-full items-center justify-between p-3 text-sm font-medium"
              >
                {{ $t("pages.settings.application.plugins.advanced") }}
                <ChevronDown
                  class="h-4 w-4 transition-transform"
                  :class="{ 'rotate-180': showAdvanced }"
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent class="space-y-4 border-t p-3">
              <div class="space-y-2">
                <Label>{{
                  $t("pages.settings.application.plugins.fields.slug")
                }}</Label>
                <Input
                  v-model="form.slug"
                  required
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  placeholder="inventory"
                />
              </div>

              <div class="space-y-2">
                <Label>{{
                  $t(
                    "pages.settings.application.plugins.fields.remote_entry_url",
                  )
                }}</Label>
                <Input
                  v-model="form.remote_entry_url"
                  required
                  placeholder="https://inventory.example.gg/assets/remoteEntry.js"
                />
                <p class="text-xs text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.plugins.fields.remote_entry_url_hint",
                    )
                  }}
                </p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>{{
                    $t(
                      "pages.settings.application.plugins.fields.remote_scope",
                    )
                  }}</Label>
                  <Input
                    v-model="form.remote_scope"
                    required
                    placeholder="inventory"
                  />
                  <p class="text-xs text-muted-foreground">
                    {{
                      $t(
                        "pages.settings.application.plugins.fields.remote_scope_hint",
                      )
                    }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label>{{
                    $t(
                      "pages.settings.application.plugins.fields.exposed_module",
                    )
                  }}</Label>
                  <Input
                    v-model="form.exposed_module"
                    required
                    placeholder="./App"
                  />
                  <p class="text-xs text-muted-foreground">
                    {{
                      $t(
                        "pages.settings.application.plugins.fields.exposed_module_hint",
                      )
                    }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label class="flex items-center gap-1">
                    {{
                      $t("pages.settings.application.plugins.fields.nav_group")
                    }}
                    <span class="text-xs font-normal text-muted-foreground">{{
                      $t("pages.settings.application.plugins.optional")
                    }}</span>
                  </Label>
                  <Input
                    v-model="form.nav_group"
                    :placeholder="
                      $t('pages.settings.application.plugins.fields.nav_group_placeholder')
                    "
                  />
                  <p class="text-xs text-muted-foreground">
                    {{
                      $t("pages.settings.application.plugins.fields.nav_group_hint")
                    }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="flex items-center gap-1">
                    {{
                      $t("pages.settings.application.plugins.fields.nav_order")
                    }}
                    <span class="text-xs font-normal text-muted-foreground">{{
                      $t("pages.settings.application.plugins.optional")
                    }}</span>
                  </Label>
                  <Input
                    v-model.number="form.nav_order"
                    type="number"
                    placeholder="0"
                  />
                  <p class="text-xs text-muted-foreground">
                    {{
                      $t("pages.settings.application.plugins.fields.nav_order_hint")
                    }}
                  </p>
                </div>
              </div>

              <div class="space-y-2">
                <Label class="flex items-center gap-1">
                  {{
                    $t(
                      "pages.settings.application.plugins.fields.profile_tab_label",
                    )
                  }}
                  <span class="text-xs font-normal text-muted-foreground">{{
                    $t("pages.settings.application.plugins.optional")
                  }}</span>
                </Label>
                <Input
                  v-model="form.profile_tab_label"
                  :placeholder="
                    $t(
                      'pages.settings.application.plugins.fields.profile_tab_label_placeholder',
                    )
                  "
                />
                <p class="text-xs text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.plugins.fields.profile_tab_label_hint",
                    )
                  }}
                </p>
              </div>

              <div class="space-y-2">
                <Label class="flex items-center gap-1">
                  {{
                    $t("pages.settings.application.plugins.fields.deployments")
                  }}
                  <span class="text-xs font-normal text-muted-foreground">{{
                    $t("pages.settings.application.plugins.optional")
                  }}</span>
                </Label>
                <Input
                  v-model="form.deployments"
                  :placeholder="
                    $t('pages.settings.application.plugins.fields.deployments_placeholder')
                  "
                />
                <p class="text-xs text-muted-foreground">
                  {{
                    $t("pages.settings.application.plugins.fields.deployments_hint")
                  }}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div class="flex items-center justify-between">
            <Label>{{
              $t("pages.settings.application.plugins.fields.enabled")
            }}</Label>
            <Switch v-model="form.enabled" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <Label>{{
                $t("pages.settings.application.plugins.fields.is_default")
              }}</Label>
              <p class="text-xs text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.plugins.is_default_hint",
                  )
                }}
              </p>
            </div>
            <Switch v-model="form.is_default" />
          </div>

          <DialogFooter>
            <Button type="submit" :loading="submitting">
              {{ $t("common.save") }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </SettingsPage>
</template>

<script lang="ts">
import {
  e_player_roles_enum,
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import type { Plugin } from "~/stores/Plugins";

// reka-ui Select forbids an empty-string value, so "public" is the in-form
// sentinel for "no required role"; it maps to a null column on save.
const PUBLIC_ROLE = "public";

interface PluginForm {
  id: string | null;
  title: string;
  slug: string;
  icon: string;
  remote_entry_url: string;
  remote_scope: string;
  exposed_module: string;
  required_role: string;
  enabled: boolean;
  is_default: boolean;
  nav_group: string;
  nav_order: number;
  profile_tab_label: string;
  deployments: string;
}

const emptyForm = (): PluginForm => ({
  id: null,
  title: "",
  slug: "",
  icon: "puzzle",
  remote_entry_url: "",
  remote_scope: "",
  exposed_module: "./App",
  required_role: PUBLIC_ROLE,
  enabled: true,
  is_default: false,
  nav_group: "",
  nav_order: 0,
  profile_tab_label: "",
  deployments: "",
});

export default {
  data() {
    return {
      dialogOpen: false,
      submitting: false,
      showAdvanced: false,
      detectUrl: "",
      detecting: false,
      detectError: "",
      form: emptyForm(),
      // Kept out of the shared Plugins store on purpose: that subscription runs
      // for every visitor, and `deployments` is an administrator-only column —
      // selecting it there would error the subscription and kill plugin nav for
      // everyone below admin.
      deploymentsByPlugin: {} as Record<string, string[]>,
    };
  },
  mounted() {
    void this.fetchDeployments();
  },
  computed: {
    pluginsEnabled() {
      return useApplicationSettingsStore().pluginsEnabled;
    },
    plugins() {
      return usePluginsStore().plugins;
    },
    roles() {
      return Object.values(e_player_roles_enum);
    },
  },
  methods: {
    roleLabel(role: string) {
      return role
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    },
    async fetchDeployments() {
      const { data } = await (this as any).$apollo.query({
        query: generateQuery({
          custom_pages: [{}, { id: true, deployments: true }],
        }),
        fetchPolicy: "network-only",
      });

      this.deploymentsByPlugin = Object.fromEntries(
        (data.custom_pages ?? []).map(
          ({ id, deployments }: { id: string; deployments: unknown }) => [
            id,
            Array.isArray(deployments) ? deployments : [],
          ],
        ),
      );
    },
    openCreate() {
      this.form = emptyForm();
      this.detectUrl = "";
      this.detectError = "";
      this.showAdvanced = false;
      this.dialogOpen = true;
    },
    openEdit(plugin: Plugin) {
      this.form = {
        id: plugin.id,
        title: plugin.title,
        slug: plugin.slug,
        icon: plugin.icon ?? "puzzle",
        remote_entry_url: plugin.remote_entry_url,
        remote_scope: plugin.remote_scope,
        exposed_module: plugin.exposed_module,
        required_role: plugin.required_role ?? PUBLIC_ROLE,
        enabled: plugin.enabled,
        is_default: plugin.is_default,
        nav_group: plugin.nav_group ?? "",
        nav_order: plugin.nav_order,
        profile_tab_label: plugin.profile_tab_label ?? "",
        deployments: (this.deploymentsByPlugin[plugin.id] ?? []).join(", "),
      };
      this.detectUrl = "";
      this.detectError = "";
      this.showAdvanced = false;
      this.dialogOpen = true;
    },
    async detect() {
      const input = this.detectUrl.trim();
      if (!input || this.detecting) {
        return;
      }
      this.detecting = true;
      this.detectError = "";
      try {
        // Proxy through the api (server-side fetch) so we never hit browser CORS
        // and third-party plugins don't need to allow-list the panel origin.
        const apiDomain = useRuntimeConfig().public.apiDomain;
        const response = await fetch(
          `https://${apiDomain}/plugins/detect?url=${encodeURIComponent(input)}`,
          { credentials: "include" },
        );
        if (!response.ok) {
          throw new Error(
            this.$t(
              "pages.settings.application.plugins.detect_failed",
            ) as string,
          );
        }
        const manifest = await response.json();

        this.form.title = manifest.name ?? this.form.title;
        this.form.slug = manifest.slug ?? this.form.slug;
        this.form.icon = manifest.icon ?? this.form.icon;
        this.form.remote_entry_url =
          manifest.remoteEntry ?? this.form.remote_entry_url;
        this.form.remote_scope = manifest.scope ?? this.form.remote_scope;
        this.form.exposed_module =
          manifest.module ?? this.form.exposed_module;
        if (manifest.requiredRole) {
          this.form.required_role = manifest.requiredRole;
        }
        if (manifest.profileTabLabel) {
          this.form.profile_tab_label = manifest.profileTabLabel;
        }
        // Only overwrite when the manifest actually declares deployments — an
        // older plugin that doesn't shouldn't wipe what an admin typed by hand.
        if (manifest.deployments?.length) {
          this.form.deployments = manifest.deployments.join(", ");
        }
      } catch (error) {
        this.detectError =
          error instanceof Error ? error.message : String(error);
      } finally {
        this.detecting = false;
      }
    },
    async toggleEnabled() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.custom_pages_enabled",
                value: this.pluginsEnabled ? "false" : "true",
              },
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
        title: this.$t("pages.settings.application.update_success") as string,
      });
    },
    async save() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        await this.persist();
        await this.fetchDeployments();
        this.dialogOpen = false;
        toast({
          title: this.$t(
            "pages.settings.application.update_success",
          ) as string,
        });
      } finally {
        this.submitting = false;
      }
    },
    async persist() {
      const object = {
        slug: this.form.slug,
        title: this.form.title,
        icon: this.form.icon || null,
        remote_entry_url: this.form.remote_entry_url,
        remote_scope: this.form.remote_scope,
        exposed_module: this.form.exposed_module || "./App",
        required_role:
          this.form.required_role === PUBLIC_ROLE
            ? null
            : this.form.required_role,
        enabled: this.form.enabled,
        is_default: this.form.is_default,
        nav_group: this.form.nav_group || null,
        nav_order: this.form.nav_order ?? 0,
        profile_tab_label: this.form.profile_tab_label || null,
        deployments: this.form.deployments
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      };

      // The DB allows only one is_default row (partial unique index); clear any
      // other default before this write so the upsert can't collide.
      if (this.form.is_default) {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_custom_pages: [
              {
                where: {
                  is_default: { _eq: true },
                  ...(this.form.id ? { id: { _neq: this.form.id } } : {}),
                },
                _set: { is_default: false },
              },
              { affected_rows: true },
            ],
          }),
        });
      }

      if (this.form.id) {
        // `id` isn't in custom_pages_insert_input (auto-generated), so edits use
        // update_by_pk rather than insert + on_conflict.
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_custom_pages_by_pk: [
              { pk_columns: { id: this.form.id }, _set: object },
              { id: true },
            ],
          }),
        });
      } else {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_custom_pages_one: [{ object }, { id: true }],
          }),
        });
      }
    },
    async remove(plugin: Plugin) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          delete_custom_pages_by_pk: [{ id: plugin.id }, { id: true }],
        }),
      });
      toast({
        title: this.$t("pages.settings.application.update_success") as string,
      });
    },
  },
};
</script>
