<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { toast } from "~/components/ui/toast";
import {
  UPDATE_COMPONENTS,
  buildSourceDraft,
  panelUpdateCommand,
  updateSourceChoice,
} from "~/utilities/updateSource";
import type { UpdateSourceStatus } from "~/utilities/updateSource";

const { t } = useI18n();
const key = "pages.settings.application.updates.";
const state = ref<UpdateSourceStatus | null>(null);
const busy = ref(false);
const saving = ref(false);
const error = ref("");
const choice = ref("installed");
const trackPanel = ref(false);
const repository = ref("");
const branch = ref("");
const images = reactive<Record<string, string>>({});
const editVersion = ref<string | null>(null);
const baseline = ref("");
const draft = computed(() =>
  buildSourceDraft(
    choice.value,
    images,
    trackPanel.value
      ? {
          repository: repository.value.trim(),
          ref: branch.value.trim(),
        }
      : null,
  ),
);
const dirty = computed(
  () => !!baseline.value && JSON.stringify(draft.value) !== baseline.value,
);
const apiUrl = () =>
  "https://" + useRuntimeConfig().public.apiDomain + "/system/update-source";
const command = computed(() =>
  state.value ? panelUpdateCommand(state.value.source) : "",
);
const statuses = computed(() =>
  state.value ? [state.value.panel, ...state.value.services] : [],
);

function reset() {
  if (!state.value) return;
  const source = state.value.source;
  choice.value = updateSourceChoice(source);
  for (const name of UPDATE_COMPONENTS)
    images[name] =
      source.images?.[name] ?? state.value.installedImages[name] ?? "";
  trackPanel.value = !!source.panel && source.mode === "custom";
  repository.value = source.panel?.repository ?? "";
  branch.value = source.panel?.ref ?? "";
  editVersion.value = state.value.resourceVersion;
  baseline.value = JSON.stringify(draft.value);
}
async function load(resetDraft = false) {
  busy.value = true;
  error.value = "";
  try {
    state.value = await $fetch<UpdateSourceStatus>(apiUrl(), {
      credentials: "include",
    });
    if (resetDraft) reset();
  } catch {
    error.value = t(key + "error");
  } finally {
    busy.value = false;
  }
}
async function save() {
  if (saving.value || !state.value?.writable) return;
  saving.value = true;
  error.value = "";
  try {
    await $fetch(apiUrl(), {
      method: "PUT",
      credentials: "include",
      body: { source: draft.value, resourceVersion: editVersion.value },
    });
    await load(true);
    toast({ title: t(key + "saved") });
  } catch (cause: any) {
    error.value =
      typeof cause?.data?.message === "string"
        ? cause.data.message
        : t(key + "error");
  } finally {
    saving.value = false;
  }
}
onMounted(() => load(true));
</script>

<template>
  <SettingsPage width="full">
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <form @submit.prevent="save" class="space-y-6">
      <SettingsSection
        id="source"
        :title="$t(key + 'title')"
        :description="$t(key + 'description')"
      >
        <Label for="update-source">{{ $t(key + "source") }}</Label>
        <Select v-model="choice" :disabled="saving || !state?.writable">
          <SelectTrigger id="update-source" class="max-w-lg"
            ><SelectValue
          /></SelectTrigger>
          <SelectContent>
            <SelectItem value="installed">{{
              $t(key + "installed")
            }}</SelectItem>
            <SelectItem value="stable">{{ $t(key + "stable") }}</SelectItem>
            <SelectItem value="beta">{{ $t(key + "beta") }}</SelectItem>
            <SelectItem value="custom">{{ $t(key + "custom") }}</SelectItem>
          </SelectContent>
        </Select>
        <p
          v-if="state && !state.writable"
          class="text-sm text-muted-foreground"
        >
          {{ $t(key + "setup") }}
        </p>
        <template v-if="choice === 'custom'">
          <div class="flex items-center gap-3">
            <Switch
              id="track-panel"
              :model-value="trackPanel"
              @update:model-value="trackPanel = $event"
            />
            <Label for="track-panel">{{ $t(key + "track_panel") }}</Label>
          </div>
          <div v-if="trackPanel" class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="panel-repository">{{ $t(key + "repository") }}</Label>
              <Input
                id="panel-repository"
                v-model="repository"
                placeholder="your-org/5stack-panel"
              />
            </div>
            <div class="space-y-2">
              <Label for="panel-ref">{{ $t(key + "ref") }}</Label>
              <Input id="panel-ref" v-model="branch" placeholder="testing" />
            </div>
          </div>
          <p class="text-sm text-muted-foreground">
            {{ $t(key + "image_help") }}
          </p>
          <div class="grid gap-4 md:grid-cols-2">
            <div
              v-for="name in UPDATE_COMPONENTS"
              :key="name"
              class="space-y-2 min-w-0"
            >
              <Label :for="'image-' + name">{{ name }}</Label>
              <Input
                :id="'image-' + name"
                v-model="images[name]"
                class="font-mono text-xs"
                :placeholder="'ghcr.io/your-org/' + name + ':testing'"
              />
            </div>
          </div>
        </template>
      </SettingsSection>
      <SettingsSaveBar
        :dirty="dirty"
        :submitting="saving || busy || !state?.writable"
        @save="save"
        @discard="reset"
      />
    </form>

    <SettingsSection id="builds" :title="$t(key + 'builds')">
      <div class="flex items-center justify-between gap-3">
        <p v-if="state" class="text-sm text-muted-foreground">
          {{ $t(key + "source") }}:
          {{ $t(key + updateSourceChoice(state.source)) }}
        </p>
        <Button
          variant="outline"
          size="sm"
          :disabled="busy || saving"
          @click="load(false)"
          >{{ $t("common.refresh") }}</Button
        >
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b">
              <th class="p-2">{{ $t(key + "service") }}</th>
              <th class="p-2">{{ $t(key + "installed_build") }}</th>
              <th class="p-2">{{ $t(key + "selected_build") }}</th>
              <th class="p-2">{{ $t("common.status") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in statuses"
              :key="item.service + (item.pod || '') + item.currentVersion"
              class="border-b align-top"
            >
              <td class="p-2">{{ item.plugin || item.service }}</td>
              <td class="p-2 max-w-xs">
                <div class="break-all font-mono text-xs">
                  {{ item.currentImage }}
                </div>
                <span
                  class="text-xs text-muted-foreground"
                  :title="item.currentVersion"
                  >{{ item.currentVersion?.slice(0, 19) || "—" }}</span
                >
              </td>
              <td class="p-2 max-w-xs">
                <div class="break-all font-mono text-xs">
                  {{
                    item.targetImage ||
                    (item.repository ? item.repository + "@" + item.ref : "—")
                  }}
                </div>
                <span
                  class="text-xs text-muted-foreground"
                  :title="item.newVersion || ''"
                  >{{ item.newVersion?.slice(0, 19) || "—" }}</span
                >
              </td>
              <td class="p-2">
                <span
                  :class="item.status === 'unavailable' ? 'text-amber-500' : ''"
                  >{{ $t(key + item.status.replace("-", "_")) }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SettingsSection>

    <SettingsSection
      id="apply"
      :title="$t(key + 'apply')"
      :description="$t(key + 'apply_description')"
    >
      <pre
        class="overflow-x-auto rounded-md bg-muted p-3 text-xs"
      ><code>{{ command }}</code></pre>
    </SettingsSection>
  </SettingsPage>
</template>
