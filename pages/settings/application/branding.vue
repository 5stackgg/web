<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

definePageMeta({
  layout: "application-settings",
  middleware: "admin",
});
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium">Branding</h3>
        <p class="text-sm text-muted-foreground">
          Customize your panel's logo, favicon, name, and theme colors.
        </p>
      </div>

      <!-- General -->
      <AnimatedCard variant="gradient">
        <div class="p-6 space-y-4">
        <div>
          <label class="text-sm font-medium">General</label>
          <p class="text-sm text-muted-foreground">
            Basic panel appearance settings.
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Brand Name</label>
          <p class="text-sm text-muted-foreground">
            Displayed in the sidebar and page title.
          </p>
          <Input v-model="brandName" placeholder="5Stack" class="max-w-sm" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Border Radius</label>
          <p class="text-sm text-muted-foreground">
            Controls the roundness of buttons, cards, and inputs.
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
            <span class="text-sm font-mono w-16 text-right">{{ borderRadius }}rem</span>
          </div>
        </div>

        <AnimatedCard variant="gradient" class="cursor-pointer" @click="toggleSeparators()">
          <div class="flex flex-row items-center justify-between p-4">
            <div class="space-y-0.5">
              <label class="text-sm font-medium cursor-pointer">Show Separators</label>
              <p class="text-sm text-muted-foreground">
                Display horizontal divider lines between sections.
              </p>
            </div>
            <Switch
              :model-value="showSeparators"
              @update:model-value="toggleSeparators"
            />
          </div>
        </AnimatedCard>

        <div class="space-y-2">
          <label class="text-sm font-medium">Logo</label>
          <p class="text-sm text-muted-foreground">
            Upload a custom logo for the sidebar. Recommended: square image, PNG
            or SVG.
          </p>
          <div class="flex items-center gap-4">
            <div
              class="w-16 h-16 rounded flex items-center justify-center overflow-hidden bg-muted"
            >
              <img
                v-if="logoPreview"
                :src="logoPreview"
                class="max-w-full max-h-full object-contain"
              />
              <NuxtImg
                v-else
                src="/favicon/64.png"
                class="max-w-full max-h-full"
              />
            </div>
            <div class="flex gap-2">
              <Button size="sm" @click="$refs.logoInput.click()">
                Upload Logo
              </Button>
              <Button
                v-if="logoPreview"
                size="sm"
                variant="outline"
                @click="removeLogo"
              >
                Remove
              </Button>
            </div>
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
          <label class="text-sm font-medium">Favicon</label>
          <p class="text-sm text-muted-foreground">
            Upload a custom favicon. Recommended: square image, PNG or ICO.
          </p>
          <div class="flex items-center gap-4">
            <div
              class="w-16 h-16 rounded flex items-center justify-center overflow-hidden bg-muted"
            >
              <img
                v-if="faviconPreview"
                :src="faviconPreview"
                class="max-w-full max-h-full object-contain"
              />
              <NuxtImg
                v-else
                src="/favicon/64.png"
                class="max-w-full max-h-full"
              />
            </div>
            <div class="flex gap-2">
              <Button size="sm" @click="$refs.faviconInput.click()">
                Upload Favicon
              </Button>
              <Button
                v-if="faviconPreview"
                size="sm"
                variant="outline"
                @click="removeFavicon"
              >
                Remove
              </Button>
            </div>
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
      </AnimatedCard>

      <!-- Login Page -->
      <AnimatedCard variant="gradient">
        <div class="p-6 space-y-4">
          <div>
            <label class="text-sm font-medium">Login Page</label>
            <p class="text-sm text-muted-foreground">
              Customize the login page footer link.
            </p>
          </div>

          <AnimatedCard variant="gradient" class="cursor-pointer" @click="toggleLoginFooter()">
            <div class="flex flex-row items-center justify-between p-4">
              <div class="space-y-0.5">
                <label class="text-sm font-medium cursor-pointer">Show Login Footer</label>
                <p class="text-sm text-muted-foreground">
                  Display a footer link on the login page.
                </p>
              </div>
              <Switch
                :model-value="loginShowFooter"
                @update:model-value="toggleLoginFooter"
              />
            </div>
          </AnimatedCard>

          <div class="space-y-2">
            <label class="text-sm font-medium">Footer Text</label>
            <Input v-model="loginFooterText" placeholder="5stack.gg" class="max-w-sm" />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">Footer URL</label>
            <Input v-model="loginFooterUrl" placeholder="https://github.com/5stackgg/5stack-panel" class="max-w-sm" />
          </div>
        </div>
      </AnimatedCard>

      <!-- Report an Issue -->
      <AnimatedCard variant="gradient">
        <div class="p-6 space-y-4">
          <div>
            <label class="text-sm font-medium">Report an Issue</label>
            <p class="text-sm text-muted-foreground">
              Configure the "Report an Issue" link in the sidebar and the GitHub URL.
            </p>
          </div>

          <AnimatedCard variant="gradient" class="cursor-pointer" @click="toggleReportIssue()">
            <div class="flex flex-row items-center justify-between p-4">
              <div class="space-y-0.5">
                <label class="text-sm font-medium cursor-pointer">Show Report an Issue</label>
                <p class="text-sm text-muted-foreground">
                  Display a "Report an Issue" link in the sidebar footer.
                </p>
              </div>
              <Switch
                :model-value="showReportIssue"
                @update:model-value="toggleReportIssue"
              />
            </div>
          </AnimatedCard>

          <div class="space-y-2">
            <label class="text-sm font-medium">GitHub URL</label>
            <Input v-model="githubUrl" placeholder="https://github.com/5stackgg/5stack-panel" class="max-w-sm" />
          </div>
        </div>
      </AnimatedCard>

      <!-- Theme Colors -->
      <AnimatedCard variant="gradient">
        <div class="p-6 space-y-4">
          <div>
            <label class="text-sm font-medium">Theme Colors</label>
            <p class="text-sm text-muted-foreground">
              Customize the theme colors. Changes are previewed live.
            </p>
          </div>

          <div class="flex gap-2 mb-4">
            <Button
              size="sm"
              :variant="colorMode === 'light' ? 'default' : 'outline'"
              @click="colorMode = 'light'"
            >
              Light Mode
            </Button>
            <Button
              size="sm"
              :variant="colorMode === 'dark' ? 'default' : 'outline'"
              @click="colorMode = 'dark'"
            >
              Dark Mode
            </Button>
          </div>

          <div
            v-for="section in currentColorSections"
            :key="section.title"
            class="space-y-3"
          >
            <h4 class="text-sm font-medium text-muted-foreground">
              {{ section.title }}
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
                  <p class="text-sm font-medium">{{ color.label }}</p>
                  <p class="text-xs text-muted-foreground font-mono">
                    {{ colorValues[color.key] || color.default }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedCard>

      <!-- Actions -->
      <div class="flex gap-2 flex-wrap">
        <Button @click="saveAll" :disabled="saving"> Save Branding </Button>
        <Button variant="destructive" @click="resetAll"> Reset to Defaults </Button>
        <Button variant="outline" @click="exportTheme" :disabled="exporting"> Export Theme </Button>
        <Button variant="outline" @click="$refs.importInput.click()"> Import Theme </Button>
        <input
          ref="importInput"
          type="file"
          accept=".json"
          class="hidden"
          @change="importTheme"
        />
      </div>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import {
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

interface ColorField {
  key: string;
  label: string;
  default: string;
}

interface ColorSection {
  title: string;
  fields: ColorField[];
}

const lightColorSections: ColorSection[] = [
  {
    title: "Core",
    fields: [
      { key: "public.color_background", label: "Background", default: "0 0% 100%" },
      { key: "public.color_foreground", label: "Foreground (text)", default: "240 10% 3.9%" },
      { key: "public.color_primary", label: "Primary (buttons)", default: "240 5.9% 10%" },
      { key: "public.color_primary_foreground", label: "Primary Foreground (button text)", default: "0 0% 98%" },
      { key: "public.color_secondary", label: "Secondary", default: "240 4.8% 95.9%" },
      { key: "public.color_secondary_foreground", label: "Secondary Foreground", default: "240 5.9% 10%" },
      { key: "public.color_accent", label: "Accent (selected items)", default: "240 4.8% 95.9%" },
      { key: "public.color_accent_foreground", label: "Accent Foreground", default: "240 5.9% 10%" },
      { key: "public.color_muted", label: "Muted (subtle backgrounds)", default: "240 4.8% 95.9%" },
      { key: "public.color_muted_foreground", label: "Muted Foreground (secondary text)", default: "240 3.8% 46.1%" },
      { key: "public.color_destructive", label: "Destructive (delete/error)", default: "0 84.2% 60.2%" },
      { key: "public.color_destructive_foreground", label: "Destructive Foreground", default: "0 0% 98%" },
      { key: "public.color_warning", label: "Warning", default: "36 100% 50%" },
      { key: "public.color_warning_foreground", label: "Warning Foreground", default: "0 0% 100%" },
    ],
  },
  {
    title: "Cards & Borders",
    fields: [
      { key: "public.color_card", label: "Card Background", default: "0 0% 100%" },
      { key: "public.color_card_foreground", label: "Card Text", default: "240 10% 3.9%" },
      { key: "public.color_border", label: "Borders", default: "240 5.9% 90%" },
      { key: "public.color_popover", label: "Popover Background", default: "0 0% 100%" },
      { key: "public.color_popover_foreground", label: "Popover Text", default: "240 10% 3.9%" },
      { key: "public.color_input", label: "Input Borders", default: "240 5.9% 90%" },
      { key: "public.color_ring", label: "Focus Ring", default: "240 10% 3.9%" },
    ],
  },
  {
    title: "Sidebar",
    fields: [
      { key: "public.color_sidebar_background", label: "Sidebar Background", default: "0 0% 98%" },
      { key: "public.color_sidebar_foreground", label: "Sidebar Text", default: "240 5.3% 26.1%" },
      { key: "public.color_sidebar_accent", label: "Sidebar Active/Hover", default: "240 4.8% 95.9%" },
      { key: "public.color_sidebar_accent_foreground", label: "Sidebar Active Text", default: "240 5.9% 10%" },
      { key: "public.color_sidebar_border", label: "Sidebar Border", default: "220 13% 91%" },
      { key: "public.color_sidebar_primary", label: "Sidebar Primary", default: "240 5.9% 10%" },
      { key: "public.color_sidebar_primary_foreground", label: "Sidebar Primary Text", default: "0 0% 98%" },
      { key: "public.color_sidebar_ring", label: "Sidebar Focus Ring", default: "217.2 91.2% 59.8%" },
    ],
  },
];

const darkColorSections: ColorSection[] = [
  {
    title: "Core",
    fields: [
      { key: "public.color_dark_background", label: "Background", default: "240 10% 3.9%" },
      { key: "public.color_dark_foreground", label: "Foreground (text)", default: "0 0% 98%" },
      { key: "public.color_dark_primary", label: "Primary (buttons)", default: "0 0% 98%" },
      { key: "public.color_dark_primary_foreground", label: "Primary Foreground (button text)", default: "240 5.9% 10%" },
      { key: "public.color_dark_secondary", label: "Secondary", default: "240 3.7% 15.9%" },
      { key: "public.color_dark_secondary_foreground", label: "Secondary Foreground", default: "0 0% 98%" },
      { key: "public.color_dark_accent", label: "Accent (selected items)", default: "240 3.7% 15.9%" },
      { key: "public.color_dark_accent_foreground", label: "Accent Foreground", default: "0 0% 98%" },
      { key: "public.color_dark_muted", label: "Muted (subtle backgrounds)", default: "240 3.7% 15.9%" },
      { key: "public.color_dark_muted_foreground", label: "Muted Foreground (secondary text)", default: "240 5% 64.9%" },
      { key: "public.color_dark_destructive", label: "Destructive (delete/error)", default: "0 62.8% 30.6%" },
      { key: "public.color_dark_destructive_foreground", label: "Destructive Foreground", default: "0 0% 98%" },
      { key: "public.color_dark_warning", label: "Warning", default: "36 100% 30%" },
      { key: "public.color_dark_warning_foreground", label: "Warning Foreground", default: "0 0% 100%" },
    ],
  },
  {
    title: "Cards & Borders",
    fields: [
      { key: "public.color_dark_card", label: "Card Background", default: "240 10% 3.9%" },
      { key: "public.color_dark_card_foreground", label: "Card Text", default: "0 0% 98%" },
      { key: "public.color_dark_border", label: "Borders", default: "240 3.7% 15.9%" },
      { key: "public.color_dark_popover", label: "Popover Background", default: "240 10% 3.9%" },
      { key: "public.color_dark_popover_foreground", label: "Popover Text", default: "0 0% 98%" },
      { key: "public.color_dark_input", label: "Input Borders", default: "240 3.7% 15.9%" },
      { key: "public.color_dark_ring", label: "Focus Ring", default: "240 4.9% 83.9%" },
    ],
  },
  {
    title: "Sidebar",
    fields: [
      { key: "public.color_dark_sidebar_background", label: "Sidebar Background", default: "240 5.9% 10%" },
      { key: "public.color_dark_sidebar_foreground", label: "Sidebar Text", default: "240 4.8% 95.9%" },
      { key: "public.color_dark_sidebar_accent", label: "Sidebar Active/Hover", default: "240 3.7% 15.9%" },
      { key: "public.color_dark_sidebar_accent_foreground", label: "Sidebar Active Text", default: "240 4.8% 95.9%" },
      { key: "public.color_dark_sidebar_border", label: "Sidebar Border", default: "240 3.7% 15.9%" },
      { key: "public.color_dark_sidebar_primary", label: "Sidebar Primary", default: "224.3 76.3% 48%" },
      { key: "public.color_dark_sidebar_primary_foreground", label: "Sidebar Primary Text", default: "0 0% 100%" },
      { key: "public.color_dark_sidebar_ring", label: "Sidebar Focus Ring", default: "217.2 91.2% 59.8%" },
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
      githubUrl: "",
      colorValues: {} as Record<string, string>,
      colorMode: "dark" as "light" | "dark",
      saving: false,
      exporting: false,
    };
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    showSeparators() {
      return this.settings.find(
        (s: { name: string; value: string | null }) =>
          s.name === "public.show_separators",
      )?.value !== "false";
    },
    loginShowFooter() {
      return this.settings.find(
        (s: { name: string; value: string | null }) =>
          s.name === "public.login_show_footer",
      )?.value !== "false";
    },
    showReportIssue() {
      return this.settings.find(
        (s: { name: string; value: string | null }) =>
          s.name === "public.show_report_issue",
      )?.value !== "false";
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    logoPreview() {
      const setting = this.settings.find(
        (s: { name: string }) => s.name === "public.logo_url",
      );
      return setting?.value
        ? `https://${this.apiDomain}/branding/logo`
        : null;
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
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string }>) {
        const brandSetting = newVal.find(
          (s) => s.name === "public.brand_name",
        );
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

        const githubUrlSetting = newVal.find(
          (s) => s.name === "public.github_url",
        );
        if (githubUrlSetting) {
          this.githubUrl = githubUrlSetting.value;
        }

        for (const setting of newVal) {
          if (setting.name.startsWith("public.color_")) {
            this.colorValues[setting.name] = setting.value;
          }
        }
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
    },
    async toggleReportIssue() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.show_report_issue",
                value: this.showReportIssue ? "false" : "true",
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

        toast({ title: `${type === "logo" ? "Logo" : "Favicon"} uploaded` });
      } catch (error: any) {
        toast({
          title: "Upload failed",
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
    async deleteBrandingFile(type: "logo" | "favicon") {
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

        toast({ title: `${type === "logo" ? "Logo" : "Favicon"} removed` });
      } catch (error: any) {
        toast({
          title: "Delete failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    onColorChange(key: string, event: Event) {
      const hex = (event.target as HTMLInputElement).value;
      this.colorValues[key] = this.hexToHsl(hex);
    },
    async saveAll() {
      this.saving = true;
      try {
        const objects: Array<{ name: string; value: string }> = [];

        if (this.brandName) {
          objects.push({ name: "public.brand_name", value: this.brandName });
        }

        objects.push({ name: "public.border_radius", value: this.borderRadius + "rem" });

        if (this.loginFooterText) {
          objects.push({ name: "public.login_footer_text", value: this.loginFooterText });
        }
        if (this.loginFooterUrl) {
          objects.push({ name: "public.login_footer_url", value: this.loginFooterUrl });
        }
        if (this.githubUrl) {
          objects.push({ name: "public.github_url", value: this.githubUrl });
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

        toast({ title: "Branding saved" });
      } catch (error: any) {
        toast({
          title: "Save failed",
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
        const brandingKeys: string[] = ["public.brand_name", "public.border_radius", "public.show_separators", "public.login_footer_text", "public.login_footer_url", "public.login_show_footer", "public.show_report_issue", "public.github_url"];
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
          this.deleteBrandingFile("logo"),
          this.deleteBrandingFile("favicon"),
        ]);

        this.brandName = "";
        this.borderRadius = "0.5";
        this.loginFooterText = "";
        this.loginFooterUrl = "";
        this.githubUrl = "";
        this.colorValues = {};

        await this.saveAll();
      } catch (error: any) {
        toast({
          title: "Reset failed",
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
    base64ToFile(dataUri: string, name: string, fallbackMimeType: string): File {
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
          showReportIssue: this.showReportIssue,
          githubUrl: this.githubUrl,
          colors: { ...this.colorValues },
        };

        // Fetch logo and favicon as base64
        try {
          const logoRes = await fetch(`https://${this.apiDomain}/branding/logo`, { credentials: "include" });
          if (logoRes.ok) {
            const blob = await logoRes.blob();
            data.logo = { data: await this.blobToBase64(blob), mimeType: blob.type };
          }
        } catch {}

        try {
          const faviconRes = await fetch(`https://${this.apiDomain}/branding/favicon`, { credentials: "include" });
          if (faviconRes.ok) {
            const blob = await faviconRes.blob();
            data.favicon = { data: await this.blobToBase64(blob), mimeType: blob.type };
          }
        } catch {}

        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(jsonBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "5stack-theme.json";
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Theme exported" });
      } catch (error: any) {
        toast({
          title: "Export failed",
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
          throw new Error("Invalid theme file");
        }
        if (data.brandName) {
          this.brandName = data.brandName;
        }
        if (data.borderRadius) {
          this.borderRadius = data.borderRadius;
        }
        if (typeof data.showSeparators === "boolean" && data.showSeparators !== this.showSeparators) {
          this.toggleSeparators();
        }
        if (typeof data.loginShowFooter === "boolean" && data.loginShowFooter !== this.loginShowFooter) {
          this.toggleLoginFooter();
        }
        if (typeof data.showReportIssue === "boolean" && data.showReportIssue !== this.showReportIssue) {
          this.toggleReportIssue();
        }
        if (data.githubUrl) {
          this.githubUrl = data.githubUrl;
        }
        if (data.loginFooterText) {
          this.loginFooterText = data.loginFooterText;
        }
        if (data.loginFooterUrl) {
          this.loginFooterUrl = data.loginFooterUrl;
        }
        if (typeof data.colors === "object") {
          for (const [key, value] of Object.entries(data.colors)) {
            if (typeof key === "string" && typeof value === "string" && key.startsWith("public.color_")) {
              this.colorValues[key] = value;
            }
          }
        }

        // Import logo
        if (data.logo?.data) {
          const logoFile = this.base64ToFile(data.logo.data, "logo.png", data.logo.mimeType || "image/png");
          await this.uploadBrandingFile("logo", logoFile);
        }

        // Import favicon
        if (data.favicon?.data) {
          const faviconFile = this.base64ToFile(data.favicon.data, "favicon.png", data.favicon.mimeType || "image/png");
          await this.uploadBrandingFile("favicon", faviconFile);
        }

        await this.saveAll();
      } catch (error: any) {
        toast({
          title: "Import failed",
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
