<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AlertTriangle, Trash2 } from "lucide-vue-next";
import { SELECT_NONE, nullableSelectField } from "~/utilities/selectNone";
</script>

<template>
  <form class="space-y-6" @submit.prevent="save">
    <div class="grid gap-4 md:grid-cols-2">
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>{{ $t("game_modes.form.name") }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" placeholder="Retakes" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="slug">
        <FormItem>
          <FormLabel>{{ $t("game_modes.form.slug") }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" placeholder="retakes" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
    </div>

    <FormField v-slot="{ componentField }" name="description">
      <FormItem>
        <FormLabel>{{ $t("game_modes.form.description") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="space-y-3 rounded-md border p-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-medium">{{ $t("game_modes.form.competitive_safe") }}</p>
          <p class="text-sm text-muted-foreground">
            {{ $t("game_modes.form.competitive_safe_description") }}
          </p>
        </div>
        <FormField v-slot="{ value, handleChange }" name="competitive_safe">
          <FormItem>
            <FormControl>
              <Switch :model-value="value" @update:model-value="handleChange" />
            </FormControl>
          </FormItem>
        </FormField>
      </div>

      <p
        v-if="!form.values.competitive_safe"
        class="flex items-start gap-2 text-sm text-muted-foreground"
      >
        <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
        {{ $t("game_modes.form.competitive_safe_warning") }}
      </p>
    </div>

    <!-- Compatibility is derived from the plugins below, not declared here: a
         mode runs where every plugin in it publishes a build. -->
    <div
      v-if="gameMode && supportedRuntimes.length < 2"
      class="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
    >
      {{
        supportedRuntimes.length === 0
          ? $t("game_modes.form.runtime_none")
          : $t("game_modes.form.runtime_only", {
              runtime: runtimeLabel(supportedRuntimes[0]),
            })
      }}
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium">{{ $t("game_modes.form.plugins") }}</p>
          <p class="text-sm text-muted-foreground">
            {{ $t("game_modes.form.plugins_description") }}
          </p>
        </div>
      </div>

      <p v-if="selectablePlugins.length === 0" class="text-sm text-muted-foreground">
        {{ $t("game_modes.form.no_plugins") }}
      </p>

      <div
        v-for="plugin in selectablePlugins"
        :key="plugin.slug"
        class="flex items-center justify-between gap-3 rounded-md border p-3"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium truncate">{{ plugin.name }}</span>
            <Badge variant="outline" v-if="!plugin.hot_swappable">
              {{ $t("game_modes.form.restart_required") }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground truncate">
            {{ plugin.description }}
          </p>
        </div>

        <Switch
          :model-value="selected.includes(plugin.slug)"
          @update:model-value="togglePlugin(plugin.slug)"
        />
      </div>
    </div>

    <FormField v-slot="{ componentField }" name="cfg">
      <FormItem>
        <FormLabel>{{ $t("game_modes.form.cfg") }}</FormLabel>
        <FormControl>
          <Textarea
            v-bind="componentField"
            rows="8"
            class="font-mono text-sm"
            placeholder="mp_freezetime 3"
          />
        </FormControl>
        <FormDescription>
          {{ $t("game_modes.form.cfg_description") }}
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="extra_game_params">
      <FormItem>
        <FormLabel>{{ $t("game_modes.form.extra_game_params") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" class="font-mono text-sm" />
        </FormControl>
        <FormDescription>
          {{ $t("game_modes.form.extra_game_params_description") }}
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex items-center justify-between gap-4">
      <Button
        type="button"
        variant="destructive"
        class="gap-2"
        v-if="gameMode"
        :loading="archiving"
        @click="archive"
      >
        <Trash2 class="h-4 w-4" />
        {{ $t("game_modes.form.archive") }}
      </Button>
      <span v-else />

      <Button type="submit" :loading="submitting">
        {{ $t("game_modes.form.save") }}
      </Button>
    </div>
  </form>
</template>

<script lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  props: {
    gameMode: {
      type: Object,
      required: false,
      default: null,
    },
  },
  emits: ["saved"],
  data() {
    return {
      submitting: false,
      archiving: false,
      selected: [] as Array<string>,
      availablePlugins: [] as Array<Record<string, any>>,
      alwaysLoad: [] as Array<string>,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            name: z.string().min(1),
            slug: z
              .string()
              .regex(
                /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                "lowercase letters, numbers and dashes only",
              ),
            description: z.string().optional().default(""),
            competitive_safe: z.boolean().default(false),
            cfg: z.string().optional().default(""),
            extra_game_params: z.string().optional().default(""),
          }),
        ),
      }),
    };
  },
  apollo: {
    alwaysLoad: {
      query: typedGql("query")({
        game_plugin_installs: [{}, { plugin_slug: true, always_load: true }],
      }),
      update(data: { game_plugin_installs: Array<Record<string, any>> }) {
        return data.game_plugin_installs
          .filter((entry) => entry.always_load)
          .map((entry) => entry.plugin_slug);
      },
    },
    availablePlugins: {
      query: typedGql("query")({
        game_plugins: [
          {},
          {
            slug: true,
            name: true,
            description: true,
            hot_swappable: true,
            kind: true,
          },
        ],
      }),
      update(data: { game_plugins: Array<Record<string, any>> }) {
        // Only server-side plugins can be selected by a mode; a panel plugin is
        // a web page and has nothing to load onto a game server.
        return data.game_plugins.filter((plugin) => plugin.kind !== "panel");
      },
    },
  },
  watch: {
    gameMode: {
      immediate: true,
      handler(mode: Record<string, any> | null) {
        if (!mode) {
          return;
        }

        this.form.setValues({
          name: mode.name,
          slug: mode.slug,
          description: mode.description ?? "",
          competitive_safe: mode.competitive_safe,
          cfg: mode.cfg ?? "",
          extra_game_params: mode.extra_game_params ?? "",
        });

        // Sorted here as well as in the query: save rewrites load_order from
        // this array's order, so taking the rows as they arrive would let one
        // no-op save permanently reshuffle how the server links them.
        this.selected = [...(mode.plugins ?? [])]
          .sort(
            (a: { load_order: number }, b: { load_order: number }) =>
              a.load_order - b.load_order,
          )
          .map((plugin: { plugin_slug: string }) => plugin.plugin_slug);
      },
    },
  },
  computed: {
    // A plugin set to load on every match is already on every server. Listing
    // it here reads as a choice, and unticking it would not stop it loading.
    selectablePlugins(): Array<Record<string, any>> {
      return this.availablePlugins.filter(
        (plugin: Record<string, any>) => !this.alwaysLoad.includes(plugin.slug),
      );
    },
    supportedRuntimes(): Array<string> {
      return this.gameMode?.supported_runtimes ?? [];
    },
  },
  methods: {
    runtimeLabel(runtime: string) {
      return runtime === "swiftlys2" ? "SwiftlyS2" : "CounterStrikeSharp";
    },
    togglePlugin(slug: string) {
      if (this.selected.includes(slug)) {
        this.selected = this.selected.filter((entry) => entry !== slug);
        return;
      }

      this.selected = [...this.selected, slug];
    },
    async save() {
      const { valid } = await this.form.validate();

      if (!valid || this.submitting) {
        return;
      }

      this.submitting = true;

      try {
        const values = this.form.values as Record<string, any>;
        const object = {
          name: values.name,
          slug: values.slug,
          description: values.description || null,
          competitive_safe: values.competitive_safe,
          cfg: values.cfg || null,
          extra_game_params: values.extra_game_params || null,
        };

        const gameModeId = this.gameMode
          ? await this.update(object)
          : await this.insert(object);

        await this.syncPlugins(gameModeId);

        toast({ title: this.$t("game_modes.form.saved") as string });
        this.$emit("saved", gameModeId);
      } catch (error) {
        toast({
          title: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        this.submitting = false;
      }
    },
    async insert(object: Record<string, unknown>) {
      const { data } = await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_game_modes_one: [{ object }, { id: true }],
        }),
      });

      return data.insert_game_modes_one.id;
    },
    async update(object: Record<string, unknown>) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          update_game_modes_by_pk: [
            { pk_columns: { id: this.gameMode.id }, _set: object },
            { id: true },
          ],
        }),
      });

      return this.gameMode.id;
    },
    // Replacing the selection wholesale keeps load_order in step with the order
    // the switches were toggled in, which is what the server links them in.
    //
    // Delete and insert go in one document: Hasura runs a multi-field mutation
    // in a single transaction, so an insert that fails -- a slug a concurrent
    // registry sync dropped, a lost connection -- rolls the delete back rather
    // than saving the mode with no plugins at all.
    async syncPlugins(gameModeId: string) {
      const objects = this.selected.map((slug, index) => ({
        game_mode_id: gameModeId,
        plugin_slug: slug,
        load_order: index,
      }));

      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          delete_game_mode_plugins: [
            { where: { game_mode_id: { _eq: gameModeId } } },
            { affected_rows: true },
          ],
          ...(objects.length > 0
            ? {
                insert_game_mode_plugins: [
                  { objects },
                  { affected_rows: true },
                ],
              }
            : {}),
        }),
      });
    },
    async archive() {
      if (this.archiving) {
        return;
      }

      this.archiving = true;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_game_modes_by_pk: [
              {
                pk_columns: { id: this.gameMode.id },
                _set: { archived_at: new Date().toISOString(), enabled: false },
              },
              { id: true },
            ],
          }),
        });

        toast({ title: this.$t("game_modes.form.archived") as string });
        this.$emit("saved", null);
      } catch (error) {
        toast({
          title: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        this.archiving = false;
      }
    },
  },
};
</script>
