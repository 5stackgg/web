<script setup lang="ts">
import { LucideSparkles } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card } from "~/components/ui/card";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <Card variant="gradient" class="mb-8 p-4 flex items-center gap-4">
      <div
        class="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10"
      >
        <LucideSparkles class="w-6 h-6 text-primary" />
      </div>
      <div class="flex-1">
        <h3 class="text-lg font-semibold">Highlights</h3>
        <p class="text-sm text-muted-foreground">
          Behaviour for the in-app highlight render system.
        </p>
      </div>
    </Card>
  </PageTransition>

  <PageTransition :delay="100">
    <form @submit.prevent="updateSettings" class="grid gap-6">
      <Card variant="gradient">
        <div class="p-6 space-y-6">
          <!-- Public visibility toggle. When OFF, /highlights and the
               Highlights nav entries are hidden from guests + regular
               users; streamer-rank and above (streamer / match-organizer
               / tournament-organizer / administrator) still see them
               so the curation surface remains usable. The setting is
               stored under `public.*` so the guest hasura permission
               picks it up — that's what lets the frontend render
               role-aware nav without an extra round-trip. -->
          <FormField
            v-slot="{ value, handleChange }"
            name="public.highlights_public_enabled"
            type="checkbox"
            :value="true"
          >
            <FormItem
              class="flex flex-row items-center justify-between gap-4"
            >
              <div class="space-y-1">
                <FormLabel>Show Highlights to guests</FormLabel>
                <FormDescription>
                  When enabled, anyone (including guests) can browse the
                  /highlights page. When disabled, only streamers, match
                  organizers, tournament organizers, and administrators
                  can see the Highlights pages — guests and regular
                  users won't even see the nav links.
                </FormDescription>
              </div>
              <FormControl>
                <Switch :model-value="value" @update:model-value="handleChange" />
              </FormControl>
            </FormItem>
          </FormField>

          <FormField
            v-slot="{ value, handleChange }"
            name="auto_generate_match_clips"
            type="checkbox"
            :value="true"
          >
            <FormItem
              class="flex flex-row items-center justify-between gap-4"
            >
              <div class="space-y-1">
                <FormLabel>Auto-generate match highlights</FormLabel>
                <FormDescription>
                  When a match finishes and the demo metadata parses,
                  automatically queue a "Match recap" highlight for
                  every player who got at least one kill. Renders run
                  sequentially against the demo on a single
                  game-streamer pod and land on each player's library
                  with the default visibility set below.
                </FormDescription>
              </div>
              <FormControl>
                <Switch :model-value="value" @update:model-value="handleChange" />
              </FormControl>
            </FormItem>
          </FormField>

          <FormField
            v-slot="{ value, handleChange }"
            name="auto_clip_default_visibility"
          >
            <FormItem>
              <FormLabel>Default visibility for auto-generated highlights</FormLabel>
              <FormDescription>
                What visibility level new auto-generated highlights
                start with. Private is safest — only streamer+ users
                can see private highlights via Manage Highlights.
                Public skips curation and lands the highlight on the
                public feed straight away (when public-mode is on).
              </FormDescription>
              <Select :model-value="value" @update:model-value="handleChange">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Private" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </Card>

      <div class="flex justify-start">
        <Button
          type="submit"
          :disabled="Object.keys(form.errors).length > 0"
          class="my-3"
        >
          {{ $t("common.update") }}
        </Button>
      </div>
    </form>
  </PageTransition>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            "public.highlights_public_enabled": z.boolean().default(true),
            auto_generate_match_clips: z.boolean().default(false),
            auto_clip_default_visibility: z
              .enum(["private", "unlisted", "public"])
              .default("public"),
          }),
        ),
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(rows: any[]) {
        for (const setting of rows ?? []) {
          if (
            setting.name === "auto_generate_match_clips" ||
            setting.name === "public.highlights_public_enabled"
          ) {
            // Settings are stored as text; coerce. New installs that
            // never touched this row default to true (visible) — the
            // form schema's default handles that.
            this.form.setFieldValue(
              setting.name,
              setting.value === "true" || setting.value === true,
            );
            continue;
          }
          if (setting.name === "auto_clip_default_visibility") {
            this.form.setFieldValue(setting.name, setting.value ?? "public");
          }
        }
      },
    },
  },
  methods: {
    async updateSettings() {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "public.highlights_public_enabled",
                  value: this.form.values["public.highlights_public_enabled"]
                    ? "true"
                    : "false",
                },
                {
                  name: "auto_generate_match_clips",
                  value: this.form.values.auto_generate_match_clips
                    ? "true"
                    : "false",
                },
                {
                  name: "auto_clip_default_visibility",
                  value:
                    this.form.values.auto_clip_default_visibility ?? "public",
                },
              ],
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            { __typename: true },
          ],
        }),
      });
      toast({ title: "Highlight settings updated" });
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
  },
};
</script>
