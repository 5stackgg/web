<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { AlertTriangle, ChevronDown } from "lucide-vue-next";
</script>

<template>
  <form class="space-y-6" @submit.prevent="save">
    <FormField v-slot="{ componentField }" name="url">
      <FormItem>
        <FormLabel>{{ $t("pages.plugins.custom.url") }}</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            placeholder="https://github.com/owner/repo"
          />
        </FormControl>
        <FormDescription>
          {{ $t("pages.plugins.custom.url_hint") }}
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="runtime">
      <FormItem>
        <FormLabel>{{ $t("pages.plugins.custom.runtime") }}</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue
                :placeholder="$t('pages.plugins.custom.runtime_placeholder')"
              />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="swiftlys2">SwiftlyS2</SelectItem>
              <SelectItem value="counterstrikesharp">
                CounterStrikeSharp
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormDescription>
          {{ $t("pages.plugins.custom.runtime_hint") }}
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- Everything below is derivable from a GitHub release, so it stays out of
         the way until the operator has an archive URL we can read nothing from. -->
    <Collapsible v-model:open="advanced">
      <CollapsibleTrigger as-child>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
        >
          <span
            class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.plugins.custom.advanced") }}
          </span>
          <ChevronDown
            class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200"
            :class="advanced ? 'rotate-180' : ''"
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent class="space-y-4 pt-4">
        <div class="grid gap-4 md:grid-cols-2">
          <FormField v-slot="{ componentField }" name="slug">
            <FormItem>
              <FormLabel>{{ $t("pages.plugins.custom.slug") }}</FormLabel>
              <FormControl>
                <Input v-bind="componentField" placeholder="my-plugin" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="version">
            <FormItem>
              <FormLabel>{{ $t("pages.plugins.custom.version") }}</FormLabel>
              <FormControl>
                <Input v-bind="componentField" placeholder="1.0.0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>{{ $t("pages.plugins.custom.name") }}</FormLabel>
            <FormControl>
              <Input v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="description">
          <FormItem>
            <FormLabel>{{ $t("pages.plugins.custom.summary") }}</FormLabel>
            <FormControl>
              <Textarea v-bind="componentField" rows="2" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="layout">
          <FormItem>
            <FormLabel>{{ $t("pages.plugins.custom.layout") }}</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="csgo">
                    {{ $t("pages.plugins.custom.layout_csgo") }}
                  </SelectItem>
                  <SelectItem value="plugin">
                    {{ $t("pages.plugins.custom.layout_plugin") }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormDescription>
              {{ $t("pages.plugins.custom.layout_hint") }}
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField
          v-if="form.values.layout === 'plugin'"
          v-slot="{ componentField }"
          name="installPath"
        >
          <FormItem>
            <FormLabel>{{ $t("pages.plugins.custom.install_path") }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                class="font-mono text-sm"
                placeholder="addons/{runtime}/plugins/MyPlugin"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CollapsibleContent>
    </Collapsible>

    <div
      class="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-300"
      role="alert"
    >
      <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p class="font-medium">{{ $t("pages.plugins.custom.warning_title") }}</p>
        <p class="mt-0.5 text-yellow-300/90">
          {{ $t("pages.plugins.custom.warning_description") }}
        </p>
      </div>
    </div>

    <div class="flex justify-end">
      <Button type="submit" :loading="submitting">
        {{ $t("pages.plugins.custom.submit") }}
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

export default {
  emits: ["added"],
  data() {
    return {
      submitting: false,
      advanced: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            url: z.string().url().startsWith("https://"),
            runtime: z.string().min(1),
            slug: z
              .string()
              .regex(
                /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                "lowercase letters, numbers and dashes only",
              )
              .optional()
              .or(z.literal("")),
            version: z.string().optional(),
            name: z.string().optional(),
            description: z.string().optional(),
            layout: z.string().default("csgo"),
            installPath: z.string().optional(),
          }),
        ),
        initialValues: { layout: "csgo" },
      }),
    };
  },
  methods: {
    async save() {
      const { valid } = await this.form.validate();

      if (!valid || this.submitting) {
        return;
      }

      this.submitting = true;

      try {
        const values = this.form.values as Record<string, any>;

        const { data } = await (this as any).$apollo.mutate({
          mutation: generateMutation({
            addCustomGamePlugin: [
              {
                url: values.url,
                runtime: values.runtime,
                // Blank means "work it out from the URL", which is not the same
                // as an empty slug -- the action would reject that.
                ...(values.slug ? { slug: values.slug } : {}),
                ...(values.version ? { version: values.version } : {}),
                ...(values.name ? { name: values.name } : {}),
                ...(values.description
                  ? { description: values.description }
                  : {}),
                layout: values.layout,
                ...(values.installPath
                  ? { installPath: values.installPath }
                  : {}),
              },
              { slug: true, name: true, version: true, runtime: true },
            ],
          }),
        });

        const added = data?.addCustomGamePlugin;

        toast({
          title: this.$t("pages.plugins.custom.added", {
            name: added?.name,
            version: added?.version,
          }) as string,
        });

        this.form.resetForm({ values: { layout: "csgo" } });
        this.$emit("added", added?.slug);
      } catch (error) {
        toast({
          title: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>
