<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed } from "vue";

definePageMeta({
  layout: "profile-settings",
});

const { locale, locales, setLocale } = useI18n();

const availableLocales = computed(() => {
  return locales.value.filter((i) => i.code !== locale.value);
});

const currentLocale = computed(() => {
  return locales.value.find((i) => i.code === locale.value);
});

const handleLocaleChange = (newLocale: string) => {
  setLocale(newLocale as "en" | "sv");
};
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      {{ $t("pages.settings.language.title") }}
    </h3>
    <p class="text-sm text-muted-foreground">
      {{ $t("pages.settings.language.description") }}
    </p>
  </div>
  <Separator class="my-6" />

  <div class="mt-4">
    <FormField name="language">
      <FormItem>
        <FormLabel>{{ $t("pages.settings.language.select") }}</FormLabel>
        <FormControl>
          <Select v-model="locale" @update:modelValue="handleLocaleChange">
            <SelectTrigger class="w-[200px]">
              <SelectValue>
                <div class="flex items-center gap-2">
                  <span>{{ currentLocale?.flag }}</span>
                  <span>{{ currentLocale?.name }}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="loc in locales"
                  :key="loc.code"
                  :value="loc.code"
                >
                  <div class="flex items-center gap-2">
                    <span>{{ loc.flag }}</span>
                    <span>{{ loc.name }}</span>
                  </div>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormControl>
        <FormDescription>
          {{ $t("pages.settings.language.help") }}
        </FormDescription>
      </FormItem>
    </FormField>
  </div>
</template> 