<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

definePageMeta({
  layout: "application-settings",
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

      <!-- Brand Name -->
      <div class="space-y-2">
        <label class="text-sm font-medium">Brand Name</label>
        <p class="text-sm text-muted-foreground">
          Displayed in the sidebar and page title.
        </p>
        <Input v-model="brandName" placeholder="5Stack" class="max-w-sm" />
      </div>

      <!-- Border Radius -->
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

      <!-- Show Separators -->
      <div
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="toggleSeparators()"
      >
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

      <!-- Logo Upload -->
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

      <!-- Favicon Upload -->
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

      <!-- Color Customization -->
      <div class="space-y-4">
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

      <!-- Actions -->
      <div class="flex gap-2 flex-wrap">
        <Button @click="saveAll" :disabled="saving"> Save Branding </Button>
        <Button variant="outline" @click="resetAll"> Reset to Defaults </Button>
        <Button variant="outline" @click="exportTheme"> Export Theme </Button>
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
      colorValues: {} as Record<string, string>,
      colorMode: "dark" as "light" | "dark",
      saving: false,
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
        const brandingKeys: string[] = ["public.brand_name", "public.border_radius", "public.show_separators"];
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
        this.colorValues = {};

        toast({ title: "Branding reset to defaults" });
      } catch (error: any) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    exportTheme() {
      const data = {
        brandName: this.brandName,
        borderRadius: this.borderRadius,
        showSeparators: this.showSeparators,
        colors: { ...this.colorValues },
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "5stack-theme.json";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Theme exported" });
    },
    importTheme(event: Event) {
      const input = event.target as HTMLInputElement;
      if (!input.files?.length) return;
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
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
          if (typeof data.colors === "object") {
            for (const [key, value] of Object.entries(data.colors)) {
              if (typeof key === "string" && typeof value === "string" && key.startsWith("public.color_")) {
                this.colorValues[key] = value;
              }
            }
          }
          toast({ title: "Theme imported — click Save to apply" });
        } catch (error: any) {
          toast({
            title: "Import failed",
            description: error.message,
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
      input.value = "";
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
