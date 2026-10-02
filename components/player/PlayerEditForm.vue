<script setup lang="ts">
import {
  Check,
  ChevronsUpDown,
  Clock,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  Copy,
} from "lucide-vue-next";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
</script>

<template>
  <div class="flex flex-col">
    <div class="grid flex-1 content-start gap-8 pb-6">
      <ManageSection :label="$t('player.edit.profile')">
        <template v-if="canEditAvatar && hasCustomAvatar" #action>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="text-muted-foreground hover:text-foreground"
            @click="resetAvatar"
          >
            <RotateCcw class="size-3.5" />
            {{ $t("player.edit.use_steam_avatar") }}
          </Button>
        </template>

        <div class="flex items-start gap-4">
          <ImageUploadTile
            v-if="canEditAvatar"
            ref="avatarTile"
            class="shrink-0"
            :upload-url="avatarEndpoint"
            :delete-url="avatarEndpoint"
            :has-custom="hasCustomAvatar"
            :current-src="avatarSrc"
          >
            <template #default="{ pick, busy, dragOver, dropzone }">
              <!-- Sized to the two stacked fields: 2 × (1rem label + 0.375rem gap + 2.25rem input) + 0.875rem gap. -->
              <button
                type="button"
                class="group relative size-[8.125rem] overflow-hidden rounded-md border border-border bg-muted/40"
                :class="
                  dragOver &&
                  'outline-dashed outline-2 outline-offset-2 outline-[hsl(var(--tac-amber))]'
                "
                :aria-label="$t('avatar.upload')"
                v-on="dropzone"
                @click="pick"
              >
                <img
                  v-if="avatarSrc"
                  :src="avatarSrc"
                  alt=""
                  class="size-full object-cover"
                />
                <span
                  class="absolute inset-0 grid place-items-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  :class="dragOver && 'opacity-100'"
                >
                  <Upload class="size-5" />
                </span>
                <span
                  class="absolute bottom-1.5 right-1.5 grid size-6 place-items-center rounded-md bg-black/60 text-white transition-opacity group-hover:opacity-0"
                >
                  <Pencil class="size-3" />
                </span>
                <span
                  v-if="busy"
                  class="absolute inset-0 grid place-items-center bg-background/70"
                >
                  <Spinner class="size-5 text-[hsl(var(--tac-amber))]" />
                </span>
              </button>
            </template>
          </ImageUploadTile>

          <div class="grid min-w-0 flex-1 gap-3.5">
            <div v-if="canEditName" class="grid gap-1.5">
              <div class="flex h-4 items-center justify-between gap-2">
                <label
                  for="player-edit-name"
                  class="text-xs font-medium text-muted-foreground"
                >
                  {{ $t("pages.players.detail.name") }}
                </label>
                <span
                  v-if="pendingName"
                  class="inline-flex min-w-0 items-center gap-1 text-[0.6875rem] text-[hsl(var(--tac-amber))]"
                >
                  <Clock class="size-3 shrink-0" />
                  <span class="truncate">
                    {{ $t("player.edit.pending_name", { name: pendingName }) }}
                  </span>
                </span>
              </div>
              <div class="relative">
                <Input
                  id="player-edit-name"
                  v-model="name"
                  maxlength="32"
                  class="peer pr-12"
                  :class="nameInvalid && 'border-destructive'"
                  :aria-invalid="nameInvalid"
                />
                <span
                  class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.6875rem] tabular-nums transition-opacity"
                  :class="
                    nameInvalid
                      ? 'text-destructive'
                      : 'text-muted-foreground opacity-0 peer-focus:opacity-100'
                  "
                >
                  {{ name.length }}/32
                </span>
              </div>
            </div>

            <div v-if="canEditCountry" class="grid gap-1.5">
              <span
                class="flex h-4 items-center text-xs font-medium text-muted-foreground"
              >
                {{ $t("pages.settings.account.country") }}
              </span>
              <Popover v-model:open="countryOpen">
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    role="combobox"
                    variant="outline"
                    class="w-full min-w-0 justify-between px-3 font-normal"
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      <TimezoneFlag v-if="country" :country="country" />
                      <span class="truncate">
                        {{
                          country
                            ? countries[country]?.name
                            : $t("pages.settings.account.select_country")
                        }}
                      </span>
                    </span>
                    <ChevronsUpDown class="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  class="w-[var(--reka-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput
                      :placeholder="$t('pages.settings.account.search_country')"
                    />
                    <CommandEmpty>
                      {{ $t("pages.settings.account.no_country_found") }}
                    </CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem
                          v-for="option in countryList"
                          :key="option.id"
                          :value="option.name"
                          @select="
                            () => {
                              country = option.id;
                              countryOpen = false;
                            }
                          "
                        >
                          <div class="flex w-full min-w-0 items-center gap-2">
                            <TimezoneFlag :country="option.id" />
                            <span class="truncate">{{ option.name }}</span>
                          </div>
                          <Check
                            class="ml-auto size-4 shrink-0"
                            :class="
                              country === option.id ? 'opacity-100' : 'opacity-0'
                            "
                          />
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </ManageSection>

      <ImageUploadTile
        v-if="canEditAvatar"
        class="tac-section-sep"
        mode="roster"
        kind="roster"
        :upload-url="rosterEndpoint"
        :delete-url="rosterEndpoint"
        :has-custom="hasRoster"
        :current-src="rosterSrc"
      >
        <template #default="{ pick, edit, remove, busy, dragOver, dropzone }">
          <ManageSection :label="$t('team.member.roster_image')">
            <template #action>
              <div class="flex items-center gap-2">
                <span v-if="!hasRoster" class="text-xs text-muted-foreground">
                  {{ $t("player.edit.using_avatar") }}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  :disabled="busy"
                  @click="pick"
                >
                  <Upload class="size-3.5" />
                  {{
                    hasRoster ? $t("image_upload.replace") : $t("common.upload")
                  }}
                </Button>
                <Button
                  v-if="hasRoster"
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  :disabled="busy"
                  :aria-label="$t('image_upload.remove')"
                  @click="remove"
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
            </template>

            <div
              class="relative grid grid-cols-5 gap-1.5 rounded-lg border border-border bg-gradient-to-b from-[hsl(214_30%_15%)] to-[hsl(222_25%_7%)] px-2.5 pt-2.5"
              v-on="dropzone"
            >
              <template v-for="position in 5" :key="position">
                <button
                  v-if="position === 3"
                  type="button"
                  class="group relative aspect-[400/420] overflow-hidden rounded-t-sm bg-black/25"
                  :aria-label="$t('avatar.roster_editor.title')"
                  @click="edit(hasRoster ? rosterSrc : avatarSrc)"
                >
                  <img
                    v-if="lineupSrc"
                    :src="lineupSrc"
                    alt=""
                    class="absolute inset-0 size-full"
                    :class="
                      hasRoster ? 'object-contain object-bottom' : 'object-cover'
                    "
                  />
                  <span
                    class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-gradient-to-b from-transparent to-black/80 px-1 pb-1 pt-3.5 text-[0.625rem] font-semibold text-white"
                  >
                    <TimezoneFlag v-if="country" :country="country" />
                    <span class="truncate">{{ previewName }}</span>
                  </span>
                  <span
                    class="absolute inset-0 grid place-items-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    <Pencil class="size-4" />
                  </span>
                  <span
                    class="pointer-events-none absolute inset-0 rounded-t-sm border-2 border-b-0 border-[hsl(var(--tac-amber))]"
                  ></span>
                  <span
                    v-if="busy"
                    class="absolute inset-0 grid place-items-center bg-background/70"
                  >
                    <Spinner class="size-4 text-[hsl(var(--tac-amber))]" />
                  </span>
                </button>
                <span
                  v-else
                  class="flex aspect-[400/420] items-end justify-center"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 40 42"
                    class="w-[86%] text-[hsl(218_14%_22%)]"
                    fill="currentColor"
                  >
                    <circle cx="20" cy="14.5" r="7.5" />
                    <path d="M4 42c0-9.5 7-15.5 16-15.5S36 32.5 36 42z" />
                  </svg>
                </span>
              </template>
              <div
                v-if="dragOver"
                class="absolute inset-0 grid place-items-center rounded-lg bg-black/60 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-white outline-dashed outline-2 outline-offset-2 outline-[hsl(var(--tac-amber))]"
              >
                {{ $t("image_upload.drop_to_upload") }}
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("player.edit.roster_hint") }}
            </p>

            <div v-if="teams.length > 0" class="grid gap-1.5">
              <span class="text-xs font-medium text-muted-foreground">
                {{ $t("player.edit.your_teams") }}
              </span>
              <ul class="divide-y divide-border rounded-md border border-border">
                <li
                  v-for="team in teams"
                  :key="team.teamId"
                  class="flex h-12 items-center gap-3 px-3"
                >
                  <span
                    class="relative flex aspect-[400/420] w-7 shrink-0 items-end justify-center overflow-hidden rounded-sm bg-muted/50"
                  >
                    <img
                      v-if="team.rosterImageUrl"
                      :src="resolveAvatarUrl(team.rosterImageUrl, apiDomain)"
                      alt=""
                      class="absolute inset-0 size-full object-contain object-bottom"
                    />
                    <svg
                      v-else
                      viewBox="0 0 40 42"
                      class="w-[86%] text-muted-foreground/40"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle cx="20" cy="14.5" r="7.5" />
                      <path d="M4 42c0-9.5 7-15.5 16-15.5S36 32.5 36 42z" />
                    </svg>
                  </span>
                  <span class="min-w-0 flex-1 truncate text-sm">
                    {{ team.teamName }}
                  </span>
                  <Button
                    v-if="team.canCopy"
                    type="button"
                    variant="outline"
                    size="sm"
                    :disabled="!hasRoster || copyingTeamId !== null"
                    :loading="copyingTeamId === team.teamId"
                    @click="copyToTeam(team)"
                  >
                    <Copy class="size-3.5" />
                    {{
                      team.rosterImageUrl
                        ? $t("image_upload.replace")
                        : $t("player.edit.copy")
                    }}
                  </Button>
                </li>
              </ul>
            </div>
          </ManageSection>
        </template>
      </ImageUploadTile>
    </div>

    <SettingsSaveBar
      contained
      :dirty="isDirty"
      :force-visible="isDirty"
      :valid="!nameInvalid"
      :submitting="saving"
      :description="saveBarDescription"
      @save="save"
      @discard="discard"
    />
  </div>
</template>

<script lang="ts">
import { getAllCountries } from "countries-and-timezones";
import { generateMutation } from "~/graphql/graphqlGen";
import { $, e_player_roles_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { uploadImageBlob } from "~/utilities/imagePipeline";

interface RosterTeam {
  teamId: string;
  teamName: string;
  rosterImageUrl: string | null;
  canCopy: boolean;
}

export default {
  props: {
    player: {
      type: Object,
      required: true,
    },
    canEditAvatar: Boolean,
    canEditName: Boolean,
    canEditCountry: Boolean,
    teams: {
      type: Array as () => RosterTeam[],
      default: () => [],
    },
  },
  data() {
    return {
      name: "",
      country: null as string | null,
      countryOpen: false,
      countries: getAllCountries(),
      pendingName: null as string | null,
      saving: false,
      synced: false,
      copyingTeamId: null as string | null,
    };
  },
  watch: {
    // The player is subscription-backed: only resync while nothing is being edited.
    player: {
      immediate: true,
      handler(player) {
        if (player && (!this.synced || !this.isDirty)) {
          this.discard();
          this.synced = true;
        }
      },
    },
  },
  computed: {
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    avatarEndpoint() {
      return `https://${this.apiDomain}/avatars/players/${this.player.steam_id}`;
    },
    rosterEndpoint() {
      return `https://${this.apiDomain}/avatars/roster-players/${this.player.steam_id}`;
    },
    hasCustomAvatar() {
      return !!this.player.custom_avatar_url;
    },
    hasRoster() {
      return !!this.player.roster_image_url;
    },
    avatarSrc() {
      return resolveAvatarUrl(
        this.player.custom_avatar_url || this.player.avatar_url,
        this.apiDomain,
      );
    },
    rosterSrc() {
      return resolveAvatarUrl(this.player.roster_image_url, this.apiDomain);
    },
    lineupSrc() {
      return this.rosterSrc || this.avatarSrc;
    },
    countryList() {
      return Object.values(this.countries).sort((a: any, b: any) =>
        a.name.localeCompare(b.name),
      );
    },
    trimmedName() {
      return this.name.trim();
    },
    previewName() {
      return this.trimmedName || this.player.name;
    },
    nameDirty() {
      return this.canEditName && this.trimmedName !== this.player.name;
    },
    nameInvalid() {
      return (
        this.nameDirty &&
        (this.trimmedName.length < 3 || this.trimmedName.length > 32)
      );
    },
    countryDirty() {
      return (
        this.canEditCountry &&
        !!this.country &&
        this.country !== this.player.country
      );
    },
    isDirty() {
      return this.nameDirty || this.countryDirty;
    },
    mustRequestNameChange() {
      return !useAuthStore().isRoleAbove(e_player_roles_enum.administrator);
    },
    saveBarDescription() {
      if (this.nameInvalid) return this.$t("player.edit.name_length");
      if (this.nameDirty && this.mustRequestNameChange) {
        return this.$t("player.change_name.approval_hint");
      }
      return undefined;
    },
  },
  methods: {
    resolveAvatarUrl,
    async copyToTeam(team: RosterTeam) {
      if (!this.rosterSrc || this.copyingTeamId) return;
      this.copyingTeamId = team.teamId;
      try {
        const response = await fetch(this.rosterSrc);
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        await uploadImageBlob(
          `https://${this.apiDomain}/avatars/roster-teams/${team.teamId}/${this.player.steam_id}`,
          await response.blob(),
          "roster.webp",
        );
        toast({
          title: this.$t("player.edit.copied_to_team", {
            team: team.teamName,
          }),
        });
      } catch (error: any) {
        toast({
          title: this.$t("avatar.roster_editor.bulk_failed", {
            name: team.teamName,
          }),
          description: error?.message,
          variant: "destructive",
        });
      } finally {
        this.copyingTeamId = null;
      }
    },
    resetAvatar() {
      (this.$refs.avatarTile as any)?.remove();
    },
    discard() {
      this.name = this.player.name ?? "";
      this.country = this.player.country ?? null;
    },
    async save() {
      if (!this.isDirty || this.nameInvalid || this.saving) return;
      const requestName = this.nameDirty && this.mustRequestNameChange;
      this.saving = true;
      try {
        if (this.countryDirty) {
          await this.$apollo.mutate({
            variables: { country: this.country },
            mutation: generateMutation({
              update_players_by_pk: [
                {
                  pk_columns: { steam_id: this.player.steam_id },
                  _set: { country: $("country", "String!") },
                },
                { steam_id: true },
              ],
            }),
          });
        }
        if (requestName) {
          await this.$apollo.mutate({
            variables: { name: this.trimmedName },
            mutation: generateMutation({
              requestNameChange: [
                {
                  steam_id: this.player.steam_id,
                  name: $("name", "String!"),
                },
                { success: true },
              ],
            }),
          });
          this.pendingName = this.trimmedName;
          this.name = this.player.name ?? "";
          toast({
            title: this.$t("player.change_name.request_success"),
            description: this.$t(
              "player.change_name.request_success_description",
            ),
          });
          return;
        }
        if (this.nameDirty) {
          await this.$apollo.mutate({
            variables: { name: this.trimmedName },
            mutation: generateMutation({
              update_players_by_pk: [
                {
                  pk_columns: { steam_id: this.player.steam_id },
                  _set: { name: $("name", "String!") },
                },
                { steam_id: true },
              ],
            }),
          });
        }
        toast({ title: this.$t("player.edit.saved") });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
