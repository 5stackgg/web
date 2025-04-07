<script setup lang="ts">
definePageMeta({
  layout: "profile-settings",
});

import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";

const colorMode = useColorMode();

const appearanceFormSchema = toTypedSchema(
  z.object({
    theme: z.enum(["light", "dark"], {
      required_error: "Please select a theme.",
    }),
  }),
);

const { handleSubmit } = useForm({
  validationSchema: appearanceFormSchema,
  initialValues: {
    theme: colorMode.preference || "dark",
  },
});

const onSubmit = handleSubmit((values) => {
  colorMode.preference = values.theme;
});
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      {{ $t("pages.settings.appearance.title") }}
    </h3>
    <p class="text-sm text-muted-foreground">
      {{ $t("pages.settings.appearance.description") }}
    </p>
  </div>
  <Separator />
  <form class="grid gap-4" @submit="onSubmit">
    <FormField v-slot="{ componentField }" type="radio" name="theme">
      <FormItem class="space-y-1">
        <FormLabel>{{ $t("pages.settings.appearance.theme") }}</FormLabel>
        <FormDescription>{{
          $t("pages.settings.appearance.theme_description")
        }}</FormDescription>
        <FormMessage />

        <RadioGroup
          class="grid max-w-md grid-cols-2 gap-8 pt-2"
          v-bind="componentField"
        >
          <FormItem>
            <FormLabel class="[&:has([data-state=checked])>div]:border-primary">
              <FormControl>
                <RadioGroupItem value="light" class="sr-only" />
              </FormControl>
              <div
                class="items-center rounded-md border-2 border-muted p-1 hover:border-accent"
              >
                <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
                  <div class="space-y-2 rounded-md bg-white p-2 shadow-sm">
                    <div class="h-2 w-20 rounded-lg bg-[#ecedef]" />
                    <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                  <div
                    class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm"
                  >
                    <div class="h-4 w-4 rounded-full bg-[#ecedef]" />
                    <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                  <div
                    class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm"
                  >
                    <div class="h-4 w-4 rounded-full bg-[#ecedef]" />
                    <div class="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                </div>
              </div>
              <span class="block w-full p-2 text-center font-normal">
                {{ $t("pages.settings.appearance.light") }}
              </span>
            </FormLabel>
          </FormItem>
          <FormItem>
            <FormLabel class="[&:has([data-state=checked])>div]:border-primary">
              <FormControl>
                <RadioGroupItem value="dark" class="sr-only" />
              </FormControl>
              <div
                class="items-center rounded-md border-2 border-muted p-1 hover:border-accent"
              >
                <div class="space-y-2 rounded-sm bg-slate-950 p-2">
                  <div class="space-y-2 rounded-md bg-slate-900 p-2 shadow-sm">
                    <div class="h-2 w-20 rounded-lg bg-slate-800" />
                    <div class="h-2 w-[100px] rounded-lg bg-slate-800" />
                  </div>
                  <div
                    class="flex items-center space-x-2 rounded-md bg-slate-900 p-2 shadow-sm"
                  >
                    <div class="h-4 w-4 rounded-full bg-slate-800" />
                    <div class="h-2 w-[100px] rounded-lg bg-slate-800" />
                  </div>
                  <div
                    class="flex items-center space-x-2 rounded-md bg-slate-900 p-2 shadow-sm"
                  >
                    <div class="h-4 w-4 rounded-full bg-slate-800" />
                    <div class="h-2 w-[100px] rounded-lg bg-slate-800" />
                  </div>
                </div>
              </div>
              <span class="block w-full p-2 text-center font-normal">
                {{ $t("pages.settings.appearance.dark") }}
              </span>
            </FormLabel>
          </FormItem>
        </RadioGroup>
      </FormItem>
    </FormField>

    <div class="flex justify-start">
      <Button type="submit"> Update preferences </Button>
    </div>
  </form>
</template>
