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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import CustomPageIcon from "~/components/custom-pages/CustomPageIcon.vue";
import CustomPageIconPicker from "~/components/custom-pages/CustomPageIconPicker.vue";
import { Pencil, Trash2, Plus, Wand2, ChevronDown } from "lucide-vue-next";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="custom-pages"
          :title="$t('pages.settings.application.custom_pages.section')"
          :description="
            $t('pages.settings.application.custom_pages.description')
          "
          clickable-header
          @header-click="toggleEnabled"
        >
          <template #action>
            <Switch
              :model-value="customPagesEnabled"
              @update:model-value="toggleEnabled"
            />
          </template>

          <div v-if="customPagesEnabled" class="space-y-4">
            <div class="flex justify-end">
              <Button variant="outline" class="gap-2" @click="openCreate">
                <Plus class="h-4 w-4" />
                {{ $t("pages.settings.application.custom_pages.add") }}
              </Button>
            </div>

            <Table v-if="pages.length > 0">
              <TableHeader>
                <TableRow>
                  <TableHead>{{
                    $t("pages.settings.application.custom_pages.fields.title")
                  }}</TableHead>
                  <TableHead>{{
                    $t("pages.settings.application.custom_pages.fields.slug")
                  }}</TableHead>
                  <TableHead>{{
                    $t(
                      "pages.settings.application.custom_pages.fields.required_role",
                    )
                  }}</TableHead>
                  <TableHead>{{
                    $t("pages.settings.application.custom_pages.fields.enabled")
                  }}</TableHead>
                  <TableHead>{{
                    $t(
                      "pages.settings.application.custom_pages.fields.is_default",
                    )
                  }}</TableHead>
                  <TableHead class="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="page in pages" :key="page.id">
                  <TableCell class="flex items-center gap-2 font-medium">
                    <CustomPageIcon :name="page.icon" class="h-4 w-4" />
                    {{ page.title }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    /apps/{{ page.slug }}
                  </TableCell>
                  <TableCell class="capitalize">
                    {{
                      page.required_role ||
                      $t("pages.settings.application.custom_pages.public")
                    }}
                  </TableCell>
                  <TableCell>{{ page.enabled ? "✓" : "—" }}</TableCell>
                  <TableCell>{{ page.is_default ? "✓" : "—" }}</TableCell>
                  <TableCell class="text-right">
                    <div class="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        @click="openEdit(page)"
                      >
                        <Pencil class="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        @click="remove(page)"
                      >
                        <Trash2 class="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <p v-else class="text-sm text-muted-foreground">
              {{ $t("pages.settings.application.custom_pages.empty") }}
            </p>
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
                ? $t("pages.settings.application.custom_pages.edit_title")
                : $t("pages.settings.application.custom_pages.add_title")
            }}
          </DialogTitle>
          <DialogDescription>
            {{ $t("pages.settings.application.custom_pages.form_description") }}
          </DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="save">
          <div class="space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
            <Label class="flex items-center gap-2">
              <Wand2 class="h-4 w-4 text-primary" />
              {{ $t("pages.settings.application.custom_pages.detect_label") }}
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
                {{ $t("pages.settings.application.custom_pages.detect") }}
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.settings.application.custom_pages.detect_hint") }}
            </p>
            <p v-if="detectError" class="text-xs text-destructive">
              {{ detectError }}
            </p>
          </div>

          <div class="space-y-2">
            <Label>{{
              $t("pages.settings.application.custom_pages.fields.title")
            }}</Label>
            <Input v-model="form.title" required />
          </div>

          <div class="space-y-2">
            <Label>{{
              $t("pages.settings.application.custom_pages.fields.icon")
            }}</Label>
            <CustomPageIconPicker v-model="form.icon" />
          </div>

          <div class="space-y-2">
            <Label>{{
              $t("pages.settings.application.custom_pages.fields.required_role")
            }}</Label>
            <Select v-model="form.required_role">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="public">
                    {{
                      $t("pages.settings.application.custom_pages.public")
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
                {{ $t("pages.settings.application.custom_pages.advanced") }}
                <ChevronDown
                  class="h-4 w-4 transition-transform"
                  :class="{ 'rotate-180': showAdvanced }"
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent class="space-y-4 border-t p-3">
              <div class="space-y-2">
                <Label>{{
                  $t("pages.settings.application.custom_pages.fields.slug")
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
                    "pages.settings.application.custom_pages.fields.remote_entry_url",
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
                      "pages.settings.application.custom_pages.fields.remote_entry_url_hint",
                    )
                  }}
                </p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label>{{
                    $t(
                      "pages.settings.application.custom_pages.fields.remote_scope",
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
                        "pages.settings.application.custom_pages.fields.remote_scope_hint",
                      )
                    }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label>{{
                    $t(
                      "pages.settings.application.custom_pages.fields.exposed_module",
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
                        "pages.settings.application.custom_pages.fields.exposed_module_hint",
                      )
                    }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label class="flex items-center gap-1">
                    {{
                      $t("pages.settings.application.custom_pages.fields.nav_group")
                    }}
                    <span class="text-xs font-normal text-muted-foreground">{{
                      $t("pages.settings.application.custom_pages.optional")
                    }}</span>
                  </Label>
                  <Input
                    v-model="form.nav_group"
                    :placeholder="
                      $t('pages.settings.application.custom_pages.fields.nav_group_placeholder')
                    "
                  />
                  <p class="text-xs text-muted-foreground">
                    {{
                      $t("pages.settings.application.custom_pages.fields.nav_group_hint")
                    }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label class="flex items-center gap-1">
                    {{
                      $t("pages.settings.application.custom_pages.fields.nav_order")
                    }}
                    <span class="text-xs font-normal text-muted-foreground">{{
                      $t("pages.settings.application.custom_pages.optional")
                    }}</span>
                  </Label>
                  <Input
                    v-model.number="form.nav_order"
                    type="number"
                    placeholder="0"
                  />
                  <p class="text-xs text-muted-foreground">
                    {{
                      $t("pages.settings.application.custom_pages.fields.nav_order_hint")
                    }}
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div class="flex items-center justify-between">
            <Label>{{
              $t("pages.settings.application.custom_pages.fields.enabled")
            }}</Label>
            <Switch v-model="form.enabled" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <Label>{{
                $t("pages.settings.application.custom_pages.fields.is_default")
              }}</Label>
              <p class="text-xs text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.custom_pages.is_default_hint",
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
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import type { CustomPage } from "~/stores/CustomPages";

// reka-ui Select forbids an empty-string value, so "public" is the in-form
// sentinel for "no required role"; it maps to a null column on save.
const PUBLIC_ROLE = "public";

interface CustomPageForm {
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
}

const emptyForm = (): CustomPageForm => ({
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
    };
  },
  computed: {
    customPagesEnabled() {
      return useApplicationSettingsStore().customPagesEnabled;
    },
    pages() {
      return useCustomPagesStore().pages;
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
    openCreate() {
      this.form = emptyForm();
      this.detectUrl = "";
      this.detectError = "";
      this.showAdvanced = false;
      this.dialogOpen = true;
    },
    openEdit(page: CustomPage) {
      this.form = {
        id: page.id,
        title: page.title,
        slug: page.slug,
        icon: page.icon ?? "puzzle",
        remote_entry_url: page.remote_entry_url,
        remote_scope: page.remote_scope,
        exposed_module: page.exposed_module,
        required_role: page.required_role ?? PUBLIC_ROLE,
        enabled: page.enabled,
        is_default: page.is_default,
        nav_group: page.nav_group ?? "",
        nav_order: page.nav_order,
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
          `https://${apiDomain}/custom-pages/detect?url=${encodeURIComponent(input)}`,
          { credentials: "include" },
        );
        if (!response.ok) {
          throw new Error(
            this.$t(
              "pages.settings.application.custom_pages.detect_failed",
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
                value: this.customPagesEnabled ? "false" : "true",
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
    async remove(page: CustomPage) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          delete_custom_pages_by_pk: [{ id: page.id }, { id: true }],
        }),
      });
      toast({
        title: this.$t("pages.settings.application.update_success") as string,
      });
    },
  },
};
</script>
