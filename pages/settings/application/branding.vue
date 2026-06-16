<script setup lang="ts">
import {
  LucideSun,
  LucideMoon,
  LucideUpload,
  LucideX,
} from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
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
} from "@/components/ui/alert-dialog";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="general"
          :title="$t('pages.settings.application.branding.general')"
          :description="
            $t('pages.settings.application.branding.general_description')
          "
        >
          <template #action>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                @click="exportTheme"
                :disabled="exporting"
              >
                {{ $t("pages.settings.application.branding.export_theme") }}
              </Button>
              <Button
                size="sm"
                variant="outline"
                @click="$refs.importInput.click()"
              >
                {{ $t("pages.settings.application.branding.import_theme") }}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button size="sm" variant="destructive">
                    {{
                      $t("pages.settings.application.branding.reset_to_defaults")
                    }}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{{
                      $t(
                        "pages.settings.application.branding.reset_confirm_title",
                      )
                    }}</AlertDialogTitle>
                    <AlertDialogDescription>{{
                      $t(
                        "pages.settings.application.branding.reset_confirm_description",
                      )
                    }}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{{
                      $t("common.cancel")
                    }}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" @click="resetAll">{{
                      $t("pages.settings.application.branding.reset_to_defaults")
                    }}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <input
                ref="importInput"
                type="file"
                accept=".json"
                class="hidden"
                @change="importTheme"
              />
            </div>
          </template>

          <div class="space-y-2">
            <label class="text-sm font-medium">{{
              $t("pages.settings.application.branding.brand_name")
            }}</label>
            <p class="text-sm text-muted-foreground">
              {{
                $t("pages.settings.application.branding.brand_name_description")
              }}
            </p>
            <Input v-model="brandName" placeholder="5Stack" class="max-w-sm" />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">{{
              $t("pages.settings.application.branding.border_radius")
            }}</label>
            <p class="text-sm text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.branding.border_radius_description",
                )
              }}
            </p>
            <div class="flex items-center gap-3 max-w-sm">
              <input
                type="range"
                v-model="borderRadius"
                min="0"
                max="1.5"
                step="0.125"
                class="flex-1"
              />
              <span class="text-sm font-mono w-16 text-right"
                >{{ borderRadius }}rem</span
              >
            </div>
          </div>

          <div
            class="flex flex-row items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-accent/40 transition-colors"
            @click="toggleSeparators()"
          >
            <div class="space-y-0.5">
              <label class="text-sm font-medium cursor-pointer">{{
                $t("pages.settings.application.branding.show_separators")
              }}</label>
              <p class="text-sm text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.branding.show_separators_description",
                  )
                }}
              </p>
            </div>
            <Switch
              :model-value="showSeparators"
              @update:model-value="toggleSeparators"
            />
          </div>
        </SettingsSection>

        <SettingsSection
          id="assets"
          :title="$t('pages.settings.application.branding.assets_section')"
          :description="
            $t('pages.settings.application.branding.assets_section_description')
          "
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{
                $t("pages.settings.application.branding.logo")
              }}</label>
              <p class="text-sm text-muted-foreground">
                {{ $t("pages.settings.application.branding.logo_description") }}
              </p>
              <div
                role="button"
                tabindex="0"
                :aria-label="$t('pages.settings.application.branding.upload_logo')"
                class="group relative flex h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-muted/20 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-accent/30"
                @click="$refs.logoInput.click()"
                @keydown.enter.prevent="$refs.logoInput.click()"
                @keydown.space.prevent="$refs.logoInput.click()"
              >
                <img
                  v-if="logoPreview"
                  :src="logoPreview"
                  class="max-h-24 max-w-[80%] object-contain"
                />
                <NuxtImg
                  v-else
                  src="/favicon/64.png"
                  class="max-h-24 max-w-[80%] object-contain opacity-90"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm font-medium opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                >
                  <LucideUpload class="h-4 w-4" />
                  {{ $t("pages.settings.application.branding.upload_logo") }}
                </div>
                <button
                  v-if="logoPreview"
                  type="button"
                  :aria-label="$t('pages.settings.application.branding.remove')"
                  class="absolute right-2 top-2 z-10 rounded-full border bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:border-destructive/50 hover:text-destructive group-hover:opacity-100"
                  @click.stop="removeLogo"
                >
                  <LucideX class="h-3.5 w-3.5" />
                </button>
                <input
                  ref="logoInput"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  class="hidden"
                  @change="handleLogoUpload"
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">{{
                $t("pages.settings.application.branding.favicon")
              }}</label>
              <p class="text-sm text-muted-foreground">
                {{
                  $t("pages.settings.application.branding.favicon_description")
                }}
              </p>
              <div
                role="button"
                tabindex="0"
                :aria-label="
                  $t('pages.settings.application.branding.upload_favicon')
                "
                class="group relative flex h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-muted/20 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-accent/30"
                @click="$refs.faviconInput.click()"
                @keydown.enter.prevent="$refs.faviconInput.click()"
                @keydown.space.prevent="$refs.faviconInput.click()"
              >
                <img
                  v-if="faviconPreview"
                  :src="faviconPreview"
                  class="max-h-24 max-w-[80%] object-contain"
                />
                <NuxtImg
                  v-else
                  src="/favicon/64.png"
                  class="max-h-24 max-w-[80%] object-contain opacity-90"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm font-medium opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                >
                  <LucideUpload class="h-4 w-4" />
                  {{ $t("pages.settings.application.branding.upload_favicon") }}
                </div>
                <button
                  v-if="faviconPreview"
                  type="button"
                  :aria-label="$t('pages.settings.application.branding.remove')"
                  class="absolute right-2 top-2 z-10 rounded-full border bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:border-destructive/50 hover:text-destructive group-hover:opacity-100"
                  @click.stop="removeFavicon"
                >
                  <LucideX class="h-3.5 w-3.5" />
                </button>
                <input
                  ref="faviconInput"
                  type="file"
                  accept="image/png,image/jpeg,image/x-icon,image/webp"
                  class="hidden"
                  @change="handleFaviconUpload"
                />
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          id="login"
          :title="$t('pages.settings.application.branding.login_page')"
          :description="
            $t('pages.settings.application.branding.login_page_description')
          "
        >
          <div
            class="flex flex-row items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-accent/40 transition-colors"
            @click="toggleLoginFooter()"
          >
            <div class="space-y-0.5">
              <label class="text-sm font-medium cursor-pointer">{{
                $t("pages.settings.application.branding.show_login_footer")
              }}</label>
              <p class="text-sm text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.branding.show_login_footer_description",
                  )
                }}
              </p>
            </div>
            <Switch
              :model-value="loginShowFooter"
              @update:model-value="toggleLoginFooter"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{
                $t("pages.settings.application.branding.footer_text")
              }}</label>
              <Input v-model="loginFooterText" placeholder="5stack.gg" />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">{{
                $t("pages.settings.application.branding.footer_url")
              }}</label>
              <Input
                v-model="loginFooterUrl"
                placeholder="https://github.com/5stackgg/5stack-panel"
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          id="theme"
          :title="$t('pages.settings.application.branding.theme_colors')"
          :description="
            $t('pages.settings.application.branding.theme_colors_description')
          "
        >
          <template #action>
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium">
                {{
                  colorMode === "dark"
                    ? $t("pages.settings.application.branding.dark_mode")
                    : $t("pages.settings.application.branding.light_mode")
                }}
              </span>
              <button
                type="button"
                role="switch"
                :aria-checked="colorMode === 'dark'"
                :aria-label="
                  colorMode === 'dark'
                    ? $t('pages.settings.application.branding.dark_mode')
                    : $t('pages.settings.application.branding.light_mode')
                "
                class="relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-300"
                :class="
                  colorMode === 'dark'
                    ? 'border-slate-600 bg-gradient-to-r from-slate-800 to-indigo-950'
                    : 'border-amber-300/70 bg-gradient-to-r from-sky-300 to-amber-200'
                "
                @click="colorMode = colorMode === 'dark' ? 'light' : 'dark'"
              >
                <LucideSun
                  class="pointer-events-none absolute left-2 h-3.5 w-3.5 text-amber-400 transition-opacity"
                  :class="colorMode === 'dark' ? 'opacity-70' : 'opacity-0'"
                />
                <LucideMoon
                  class="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-200 transition-opacity"
                  :class="colorMode === 'dark' ? 'opacity-0' : 'opacity-70'"
                />
                <span
                  class="pointer-events-none absolute flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300"
                  :class="
                    colorMode === 'dark' ? 'translate-x-9' : 'translate-x-1'
                  "
                >
                  <LucideMoon
                    v-if="colorMode === 'dark'"
                    class="h-3.5 w-3.5 text-indigo-600"
                  />
                  <LucideSun v-else class="h-3.5 w-3.5 text-amber-500" />
                </span>
              </button>
            </div>
          </template>

          <div
            v-for="section in currentColorSections"
            :key="section.titleKey"
            class="space-y-3"
          >
            <h4 class="text-sm font-medium text-muted-foreground">
              {{ $t(section.titleKey) }}
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                v-for="color in section.fields"
                :key="color.key"
                class="flex items-center gap-3"
              >
                <input
                  type="color"
                  :value="hslToHex(colorValues[color.key] || color.default)"
                  @input="onColorChange(color.key, $event)"
                  class="w-10 h-10 rounded cursor-pointer bg-transparent"
                />
                <div>
                  <p class="text-sm font-medium">{{ $t(color.labelKey) }}</p>
                  <p class="text-xs text-muted-foreground font-mono">
                    {{ colorValues[color.key] || color.default }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSaveBar
          :dirty="brandingDirty"
          :submitting="saving"
          @save="saveAll"
          @discard="discardBranding"
        />
      </div>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

interface ColorField {
  key: string;
  labelKey: string;
  default: string;
}

interface ColorSection {
  titleKey: string;
  fields: ColorField[];
}

const lightColorSections: ColorSection[] = [
  {
    titleKey: "pages.settings.application.branding.sections.core",
    fields: [
      {
        key: "public.color_background",
        labelKey: "pages.settings.application.branding.colors.background",
        default: "0 0% 100%",
      },
      {
        key: "public.color_foreground",
        labelKey: "pages.settings.application.branding.colors.foreground",
        default: "240 10% 3.9%",
      },
      {
        key: "public.color_primary",
        labelKey: "pages.settings.application.branding.colors.primary",
        default: "240 5.9% 10%",
      },
      {
        key: "public.color_primary_foreground",
        labelKey:
          "pages.settings.application.branding.colors.primary_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_secondary",
        labelKey: "pages.settings.application.branding.colors.secondary",
        default: "240 4.8% 95.9%",
      },
      {
        key: "public.color_secondary_foreground",
        labelKey:
          "pages.settings.application.branding.colors.secondary_foreground",
        default: "240 5.9% 10%",
      },
      {
        key: "public.color_accent",
        labelKey: "pages.settings.application.branding.colors.accent",
        default: "240 4.8% 95.9%",
      },
      {
        key: "public.color_accent_foreground",
        labelKey:
          "pages.settings.application.branding.colors.accent_foreground",
        default: "240 5.9% 10%",
      },
      {
        key: "public.color_muted",
        labelKey: "pages.settings.application.branding.colors.muted",
        default: "240 4.8% 95.9%",
      },
      {
        key: "public.color_muted_foreground",
        labelKey: "pages.settings.application.branding.colors.muted_foreground",
        default: "240 3.8% 46.1%",
      },
      {
        key: "public.color_destructive",
        labelKey: "pages.settings.application.branding.colors.destructive",
        default: "0 84.2% 60.2%",
      },
      {
        key: "public.color_destructive_foreground",
        labelKey:
          "pages.settings.application.branding.colors.destructive_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_warning",
        labelKey: "pages.settings.application.branding.colors.warning",
        default: "36 100% 50%",
      },
      {
        key: "public.color_warning_foreground",
        labelKey:
          "pages.settings.application.branding.colors.warning_foreground",
        default: "0 0% 100%",
      },
    ],
  },
  {
    titleKey: "pages.settings.application.branding.sections.cards_borders",
    fields: [
      {
        key: "public.color_card",
        labelKey: "pages.settings.application.branding.colors.card",
        default: "0 0% 100%",
      },
      {
        key: "public.color_card_foreground",
        labelKey: "pages.settings.application.branding.colors.card_foreground",
        default: "240 10% 3.9%",
      },
      {
        key: "public.color_border",
        labelKey: "pages.settings.application.branding.colors.border",
        default: "240 5.9% 90%",
      },
      {
        key: "public.color_popover",
        labelKey: "pages.settings.application.branding.colors.popover",
        default: "0 0% 100%",
      },
      {
        key: "public.color_popover_foreground",
        labelKey:
          "pages.settings.application.branding.colors.popover_foreground",
        default: "240 10% 3.9%",
      },
      {
        key: "public.color_input",
        labelKey: "pages.settings.application.branding.colors.input",
        default: "240 5.9% 90%",
      },
      {
        key: "public.color_ring",
        labelKey: "pages.settings.application.branding.colors.ring",
        default: "240 10% 3.9%",
      },
    ],
  },
  {
    titleKey: "pages.settings.application.branding.sections.sidebar",
    fields: [
      {
        key: "public.color_sidebar_background",
        labelKey:
          "pages.settings.application.branding.colors.sidebar_background",
        default: "0 0% 98%",
      },
      {
        key: "public.color_sidebar_foreground",
        labelKey:
          "pages.settings.application.branding.colors.sidebar_foreground",
        default: "240 5.3% 26.1%",
      },
      {
        key: "public.color_sidebar_accent",
        labelKey: "pages.settings.application.branding.colors.sidebar_accent",
        default: "240 4.8% 95.9%",
      },
      {
        key: "public.color_sidebar_accent_foreground",
        labelKey:
          "pages.settings.application.branding.colors.sidebar_accent_foreground",
        default: "240 5.9% 10%",
      },
      {
        key: "public.color_sidebar_border",
        labelKey: "pages.settings.application.branding.colors.sidebar_border",
        default: "220 13% 91%",
      },
      {
        key: "public.color_sidebar_primary",
        labelKey: "pages.settings.application.branding.colors.sidebar_primary",
        default: "240 5.9% 10%",
      },
      {
        key: "public.color_sidebar_primary_foreground",
        labelKey:
          "pages.settings.application.branding.colors.sidebar_primary_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_sidebar_ring",
        labelKey: "pages.settings.application.branding.colors.sidebar_ring",
        default: "217.2 91.2% 59.8%",
      },
    ],
  },
  {
    titleKey: "pages.settings.application.branding.sections.top_nav",
    fields: [
      {
        key: "public.color_topnav_background",
        labelKey:
          "pages.settings.application.branding.colors.topnav_background",
        default: "0 0% 98%",
      },
      {
        key: "public.color_topnav_foreground",
        labelKey:
          "pages.settings.application.branding.colors.topnav_foreground",
        default: "240 5.3% 26.1%",
      },
      {
        key: "public.color_topnav_accent",
        labelKey: "pages.settings.application.branding.colors.topnav_accent",
        default: "142 77% 73%",
      },
      {
        key: "public.color_topnav_accent_foreground",
        labelKey:
          "pages.settings.application.branding.colors.topnav_accent_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_topnav_border",
        labelKey: "pages.settings.application.branding.colors.topnav_border",
        default: "220 13% 91%",
      },
      {
        key: "public.color_topnav_primary",
        labelKey: "pages.settings.application.branding.colors.topnav_primary",
        default: "240 5.9% 10%",
      },
      {
        key: "public.color_topnav_primary_foreground",
        labelKey:
          "pages.settings.application.branding.colors.topnav_primary_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_topnav_ring",
        labelKey: "pages.settings.application.branding.colors.topnav_ring",
        default: "217.2 91.2% 59.8%",
      },
    ],
  },
  {
    titleKey: "pages.settings.application.branding.sections.tactical",
    fields: [
      {
        key: "public.color_tactical_amber",
        labelKey: "pages.settings.application.branding.colors.tactical_amber",
        default: "33 94% 58%",
      },
      {
        key: "public.color_tactical_amber_foreground",
        labelKey:
          "pages.settings.application.branding.colors.tactical_amber_foreground",
        default: "0 0% 10%",
      },
    ],
  },
];

const darkColorSections: ColorSection[] = [
  {
    titleKey: "pages.settings.application.branding.sections.core",
    fields: [
      {
        key: "public.color_dark_background",
        labelKey: "pages.settings.application.branding.colors.background",
        default: "240 10% 3.9%",
      },
      {
        key: "public.color_dark_foreground",
        labelKey: "pages.settings.application.branding.colors.foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_primary",
        labelKey: "pages.settings.application.branding.colors.primary",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_primary_foreground",
        labelKey:
          "pages.settings.application.branding.colors.primary_foreground",
        default: "240 5.9% 10%",
      },
      {
        key: "public.color_dark_secondary",
        labelKey: "pages.settings.application.branding.colors.secondary",
        default: "240 3.7% 15.9%",
      },
      {
        key: "public.color_dark_secondary_foreground",
        labelKey:
          "pages.settings.application.branding.colors.secondary_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_accent",
        labelKey: "pages.settings.application.branding.colors.accent",
        default: "240 3.7% 15.9%",
      },
      {
        key: "public.color_dark_accent_foreground",
        labelKey:
          "pages.settings.application.branding.colors.accent_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_muted",
        labelKey: "pages.settings.application.branding.colors.muted",
        default: "240 3.7% 15.9%",
      },
      {
        key: "public.color_dark_muted_foreground",
        labelKey: "pages.settings.application.branding.colors.muted_foreground",
        default: "240 5% 64.9%",
      },
      {
        key: "public.color_dark_destructive",
        labelKey: "pages.settings.application.branding.colors.destructive",
        default: "0 62.8% 30.6%",
      },
      {
        key: "public.color_dark_destructive_foreground",
        labelKey:
          "pages.settings.application.branding.colors.destructive_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_warning",
        labelKey: "pages.settings.application.branding.colors.warning",
        default: "36 100% 30%",
      },
      {
        key: "public.color_dark_warning_foreground",
        labelKey:
          "pages.settings.application.branding.colors.warning_foreground",
        default: "0 0% 100%",
      },
    ],
  },
  {
    titleKey: "pages.settings.application.branding.sections.cards_borders",
    fields: [
      {
        key: "public.color_dark_card",
        labelKey: "pages.settings.application.branding.colors.card",
        default: "240 10% 3.9%",
      },
      {
        key: "public.color_dark_card_foreground",
        labelKey: "pages.settings.application.branding.colors.card_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_border",
        labelKey: "pages.settings.application.branding.colors.border",
        default: "240 3.7% 15.9%",
      },
      {
        key: "public.color_dark_popover",
        labelKey: "pages.settings.application.branding.colors.popover",
        default: "240 10% 3.9%",
      },
      {
        key: "public.color_dark_popover_foreground",
        labelKey:
          "pages.settings.application.branding.colors.popover_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_input",
        labelKey: "pages.settings.application.branding.colors.input",
        default: "240 3.7% 15.9%",
      },
      {
        key: "public.color_dark_ring",
        labelKey: "pages.settings.application.branding.colors.ring",
        default: "240 4.9% 83.9%",
      },
    ],
  },
  {
    titleKey: "pages.settings.application.branding.sections.sidebar",
    fields: [
      {
        key: "public.color_dark_sidebar_background",
        labelKey:
          "pages.settings.application.branding.colors.sidebar_background",
        default: "240 5.9% 10%",
      },
      {
        key: "public.color_dark_sidebar_foreground",
        labelKey:
          "pages.settings.application.branding.colors.sidebar_foreground",
        default: "240 4.8% 95.9%",
      },
      {
        key: "public.color_dark_sidebar_accent",
        labelKey: "pages.settings.application.branding.colors.sidebar_accent",
        default: "240 3.7% 15.9%",
      },
      {
        key: "public.color_dark_sidebar_accent_foreground",
        labelKey:
          "pages.settings.application.branding.colors.sidebar_accent_foreground",
        default: "240 4.8% 95.9%",
      },
      {
        key: "public.color_dark_sidebar_border",
        labelKey: "pages.settings.application.branding.colors.sidebar_border",
        default: "240 3.7% 15.9%",
      },
      {
        key: "public.color_dark_sidebar_primary",
        labelKey: "pages.settings.application.branding.colors.sidebar_primary",
        default: "224.3 76.3% 48%",
      },
      {
        key: "public.color_dark_sidebar_primary_foreground",
        labelKey:
          "pages.settings.application.branding.colors.sidebar_primary_foreground",
        default: "0 0% 100%",
      },
      {
        key: "public.color_dark_sidebar_ring",
        labelKey: "pages.settings.application.branding.colors.sidebar_ring",
        default: "217.2 91.2% 59.8%",
      },
    ],
  },
  {
    titleKey: "pages.settings.application.branding.sections.top_nav",
    fields: [
      {
        key: "public.color_dark_topnav_background",
        labelKey:
          "pages.settings.application.branding.colors.topnav_background",
        default: "240 4% 16%",
      },
      {
        key: "public.color_dark_topnav_foreground",
        labelKey:
          "pages.settings.application.branding.colors.topnav_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_topnav_accent",
        labelKey: "pages.settings.application.branding.colors.topnav_accent",
        default: "142 77% 73%",
      },
      {
        key: "public.color_dark_topnav_accent_foreground",
        labelKey:
          "pages.settings.application.branding.colors.topnav_accent_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_topnav_border",
        labelKey: "pages.settings.application.branding.colors.topnav_border",
        default: "240 3% 23%",
      },
      {
        key: "public.color_dark_topnav_primary",
        labelKey: "pages.settings.application.branding.colors.topnav_primary",
        default: "240 6% 10%",
      },
      {
        key: "public.color_dark_topnav_primary_foreground",
        labelKey:
          "pages.settings.application.branding.colors.topnav_primary_foreground",
        default: "0 0% 98%",
      },
      {
        key: "public.color_dark_topnav_ring",
        labelKey: "pages.settings.application.branding.colors.topnav_ring",
        default: "217.2 91.2% 59.8%",
      },
    ],
  },
  {
    titleKey: "pages.settings.application.branding.sections.tactical",
    fields: [
      {
        key: "public.color_dark_tactical_amber",
        labelKey: "pages.settings.application.branding.colors.tactical_amber",
        default: "33 94% 58%",
      },
      {
        key: "public.color_dark_tactical_amber_foreground",
        labelKey:
          "pages.settings.application.branding.colors.tactical_amber_foreground",
        default: "0 0% 10%",
      },
    ],
  },
];

export default {
  data() {
    return {
      brandName: "",
      borderRadius: "0.5",
      loginFooterText: "",
      loginFooterUrl: "",
      colorValues: {} as Record<string, string>,
      colorMode: "dark" as "light" | "dark",
      saving: false,
      exporting: false,
      baseline: null as string | null,
    };
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    showSeparators() {
      return (
        this.settings.find(
          (s: { name: string; value: string | null }) =>
            s.name === "public.show_separators",
        )?.value !== "false"
      );
    },
    loginShowFooter() {
      return (
        this.settings.find(
          (s: { name: string; value: string | null }) =>
            s.name === "public.login_show_footer",
        )?.value !== "false"
      );
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    logoPreview() {
      const setting = this.settings.find(
        (s: { name: string }) => s.name === "public.logo_url",
      );
      return setting?.value ? `https://${this.apiDomain}/branding/logo` : null;
    },
    faviconPreview() {
      const setting = this.settings.find(
        (s: { name: string }) => s.name === "public.favicon_url",
      );
      return setting?.value
        ? `https://${this.apiDomain}/branding/favicon`
        : null;
    },
    currentColorSections(): ColorSection[] {
      return this.colorMode === "dark" ? darkColorSections : lightColorSections;
    },
    brandingSnapshot(): string {
      return JSON.stringify({
        brandName: this.brandName,
        borderRadius: this.borderRadius,
        loginFooterText: this.loginFooterText,
        loginFooterUrl: this.loginFooterUrl,
        colors: { ...this.colorValues },
      });
    },
    brandingDirty(): boolean {
      return this.baseline !== null && this.brandingSnapshot !== this.baseline;
    },
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string }>) {
        const brandSetting = newVal.find((s) => s.name === "public.brand_name");
        if (brandSetting) {
          this.brandName = brandSetting.value;
        }

        const radiusSetting = newVal.find(
          (s) => s.name === "public.border_radius",
        );
        if (radiusSetting) {
          this.borderRadius = parseFloat(radiusSetting.value).toString();
        }

        const loginFooterTextSetting = newVal.find(
          (s) => s.name === "public.login_footer_text",
        );
        if (loginFooterTextSetting) {
          this.loginFooterText = loginFooterTextSetting.value;
        }

        const loginFooterUrlSetting = newVal.find(
          (s) => s.name === "public.login_footer_url",
        );
        if (loginFooterUrlSetting) {
          this.loginFooterUrl = loginFooterUrlSetting.value;
        }

        for (const setting of newVal) {
          if (setting.name.startsWith("public.color_")) {
            this.colorValues[setting.name] = setting.value;
          }
        }

        // Baseline the loaded values so the floating save bar only appears
        // once the admin actually edits something (and clears after a save).
        this.$nextTick(() => {
          this.baseline = this.brandingSnapshot;
        });
      },
    },
  },
  methods: {
    async toggleSeparators() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.show_separators",
                value: this.showSeparators ? "false" : "true",
              },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.settings.application.branding.branding_saved"),
      });
    },
    async toggleLoginFooter() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.login_show_footer",
                value: this.loginShowFooter ? "false" : "true",
              },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.settings.application.branding.branding_saved"),
      });
    },
    async handleLogoUpload(event: Event) {
      const input = event.target as HTMLInputElement;
      if (!input.files?.length) return;
      await this.uploadBrandingFile("logo", input.files[0]);
      input.value = "";
    },
    async handleFaviconUpload(event: Event) {
      const input = event.target as HTMLInputElement;
      if (!input.files?.length) return;
      await this.uploadBrandingFile("favicon", input.files[0]);
      input.value = "";
    },
    async uploadBrandingFile(type: "logo" | "favicon", file: File) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      try {
        const response = await fetch(
          `https://${this.apiDomain}/branding/upload`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        toast({
          title: this.$t(
            type === "logo"
              ? "pages.settings.application.branding.logo_uploaded"
              : "pages.settings.application.branding.favicon_uploaded",
          ) as string,
        });
      } catch (error: any) {
        toast({
          title: this.$t(
            "pages.settings.application.branding.upload_failed",
          ) as string,
          description: error.message,
          variant: "destructive",
        });
      }
    },
    async removeLogo() {
      await this.deleteBrandingFile("logo");
    },
    async removeFavicon() {
      await this.deleteBrandingFile("favicon");
    },
    async deleteBrandingFile(type: "logo" | "favicon", silent = false) {
      try {
        const response = await fetch(
          `https://${this.apiDomain}/branding/${type}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Delete failed: ${response.statusText}`);
        }

        if (!silent) {
          toast({
            title: this.$t(
              type === "logo"
                ? "pages.settings.application.branding.logo_removed"
                : "pages.settings.application.branding.favicon_removed",
            ) as string,
          });
        }
      } catch (error: any) {
        if (!silent) {
          toast({
            title: this.$t(
              "pages.settings.application.branding.delete_failed",
            ) as string,
            description: error.message,
            variant: "destructive",
          });
        }
      }
    },
    onColorChange(key: string, event: Event) {
      const hex = (event.target as HTMLInputElement).value;
      this.colorValues[key] = this.hexToHsl(hex);
    },
    discardBranding() {
      if (this.baseline === null) {
        return;
      }
      const snapshot = JSON.parse(this.baseline);
      this.brandName = snapshot.brandName;
      this.borderRadius = snapshot.borderRadius;
      this.loginFooterText = snapshot.loginFooterText;
      this.loginFooterUrl = snapshot.loginFooterUrl;
      this.colorValues = { ...snapshot.colors };
    },
    async saveAll() {
      this.saving = true;
      try {
        const objects: Array<{ name: string; value: string }> = [];

        if (this.brandName) {
          objects.push({ name: "public.brand_name", value: this.brandName });
        }

        objects.push({
          name: "public.border_radius",
          value: this.borderRadius + "rem",
        });

        if (this.loginFooterText) {
          objects.push({
            name: "public.login_footer_text",
            value: this.loginFooterText,
          });
        }
        if (this.loginFooterUrl) {
          objects.push({
            name: "public.login_footer_url",
            value: this.loginFooterUrl,
          });
        }
        for (const [key, value] of Object.entries(this.colorValues)) {
          if (value) {
            objects.push({ name: key, value });
          }
        }

        if (objects.length > 0) {
          await (this as any).$apollo.mutate({
            mutation: generateMutation({
              insert_settings: [
                {
                  objects,
                  on_conflict: {
                    constraint: settings_constraint.settings_pkey,
                    update_columns: [settings_update_column.value],
                  },
                },
                { __typename: true },
              ],
            }),
          });
        }

        toast({
          title: this.$t(
            "pages.settings.application.branding.branding_saved",
          ) as string,
        });
      } catch (error: any) {
        toast({
          title: this.$t(
            "pages.settings.application.branding.save_failed",
          ) as string,
          description: error.message,
          variant: "destructive",
        });
      } finally {
        this.saving = false;
      }
    },
    async resetAll() {
      try {
        // Delete all branding settings
        const brandingKeys: string[] = [
          "public.brand_name",
          "public.border_radius",
          "public.show_separators",
          "public.login_footer_text",
          "public.login_footer_url",
          "public.login_show_footer",
        ];
        for (const sections of [lightColorSections, darkColorSections]) {
          for (const section of sections) {
            for (const field of section.fields) {
              brandingKeys.push(field.key);
            }
          }
        }

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            delete_settings: [
              {
                where: {
                  name: { _in: brandingKeys },
                },
              },
              { __typename: true },
            ],
          }),
        });

        // Delete uploaded files
        await Promise.allSettled([
          this.deleteBrandingFile("logo", true),
          this.deleteBrandingFile("favicon", true),
        ]);

        this.brandName = "";
        this.borderRadius = "0.5";
        this.loginFooterText = "";
        this.loginFooterUrl = "";
        this.colorValues = {};

        toast({
          title: this.$t(
            "pages.settings.application.branding.branding_reset",
          ) as string,
        });
      } catch (error: any) {
        toast({
          title: this.$t(
            "pages.settings.application.branding.reset_failed",
          ) as string,
          description: error.message,
          variant: "destructive",
        });
      }
    },
    blobToBase64(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },
    base64ToFile(
      dataUri: string,
      name: string,
      fallbackMimeType: string,
    ): File {
      const [header, base64] = dataUri.split(",");
      const mimeMatch = header.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : fallbackMimeType;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new File([bytes], name, { type: mime });
    },
    async exportTheme() {
      this.exporting = true;
      try {
        const data: Record<string, any> = {
          brandName: this.brandName,
          borderRadius: this.borderRadius,
          showSeparators: this.showSeparators,
          loginFooterText: this.loginFooterText,
          loginFooterUrl: this.loginFooterUrl,
          loginShowFooter: this.loginShowFooter,
          colors: { ...this.colorValues },
        };

        // Fetch logo and favicon as base64
        try {
          const logoRes = await fetch(
            `https://${this.apiDomain}/branding/logo`,
            { credentials: "include" },
          );
          if (logoRes.ok) {
            const blob = await logoRes.blob();
            data.logo = {
              data: await this.blobToBase64(blob),
              mimeType: blob.type,
            };
          }
        } catch {}

        try {
          const faviconRes = await fetch(
            `https://${this.apiDomain}/branding/favicon`,
            { credentials: "include" },
          );
          if (faviconRes.ok) {
            const blob = await faviconRes.blob();
            data.favicon = {
              data: await this.blobToBase64(blob),
              mimeType: blob.type,
            };
          }
        } catch {}

        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(jsonBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "5stack-theme.json";
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: this.$t(
            "pages.settings.application.branding.theme_exported",
          ) as string,
        });
      } catch (error: any) {
        toast({
          title: this.$t(
            "pages.settings.application.branding.export_failed",
          ) as string,
          description: error.message,
          variant: "destructive",
        });
      } finally {
        this.exporting = false;
      }
    },
    async importTheme(event: Event) {
      const input = event.target as HTMLInputElement;
      if (!input.files?.length) return;
      const file = input.files[0];
      const text = await file.text();
      input.value = "";
      try {
        const data = JSON.parse(text);
        if (typeof data !== "object" || !data.colors) {
          throw new Error(
            this.$t(
              "pages.settings.application.branding.invalid_theme_file",
            ) as string,
          );
        }
        if (data.brandName) {
          this.brandName = data.brandName;
        }
        if (data.borderRadius) {
          this.borderRadius = data.borderRadius;
        }
        if (
          typeof data.showSeparators === "boolean" &&
          data.showSeparators !== this.showSeparators
        ) {
          this.toggleSeparators();
        }
        if (
          typeof data.loginShowFooter === "boolean" &&
          data.loginShowFooter !== this.loginShowFooter
        ) {
          this.toggleLoginFooter();
        }
        if (data.loginFooterText) {
          this.loginFooterText = data.loginFooterText;
        }
        if (data.loginFooterUrl) {
          this.loginFooterUrl = data.loginFooterUrl;
        }
        if (typeof data.colors === "object") {
          for (const [key, value] of Object.entries(data.colors)) {
            if (
              typeof key === "string" &&
              typeof value === "string" &&
              key.startsWith("public.color_")
            ) {
              this.colorValues[key] = value;
            }
          }
        }

        // Import logo
        if (data.logo?.data) {
          const logoFile = this.base64ToFile(
            data.logo.data,
            "logo.png",
            data.logo.mimeType || "image/png",
          );
          await this.uploadBrandingFile("logo", logoFile);
        }

        // Import favicon
        if (data.favicon?.data) {
          const faviconFile = this.base64ToFile(
            data.favicon.data,
            "favicon.png",
            data.favicon.mimeType || "image/png",
          );
          await this.uploadBrandingFile("favicon", faviconFile);
        }

        await this.saveAll();
      } catch (error: any) {
        toast({
          title: this.$t(
            "pages.settings.application.branding.import_failed",
          ) as string,
          description: error.message,
          variant: "destructive",
        });
      }
    },
    hexToHsl(hex: string): string {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
          case g:
            h = ((b - r) / d + 2) / 6;
            break;
          case b:
            h = ((r - g) / d + 4) / 6;
            break;
        }
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    },
    hslToHex(hsl: string): string {
      const parts = hsl.match(/([\d.]+)/g);
      if (!parts || parts.length < 3) return "#000000";

      const h = parseFloat(parts[0]) / 360;
      const s = parseFloat(parts[1]) / 100;
      const l = parseFloat(parts[2]) / 100;

      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      let r: number, g: number, b: number;
      if (s === 0) {
        r = g = b = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }

      const toHex = (c: number) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },
  },
};
</script>
