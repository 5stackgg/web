<script setup lang="ts">
import { Check, ChevronsUpDown, Loader2 } from "lucide-vue-next";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
</script>

<template>
  <div v-if="canChangeCountry" class="flex items-center gap-2">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          role="combobox"
          variant="outline"
          class="flex-1 min-w-0 justify-between"
        >
          <div class="flex items-center gap-2 min-w-0">
            <TimezoneFlag v-if="selected" :country="selected" />
            <span class="truncate">
              {{
                selected
                  ? countries[selected]?.name
                  : $t("pages.settings.account.select_country")
              }}
            </span>
          </div>
          <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-[300px] p-0" align="start">
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
                v-for="country in countryList"
                :key="country.id"
                :value="country.name"
                @select="
                  () => {
                    selected = country.id;
                    open = false;
                    save();
                  }
                "
              >
                <div class="flex items-center gap-2 w-full min-w-0">
                  <TimezoneFlag :country="country.id" />
                  <span class="truncate">{{ country.name }}</span>
                </div>
                <Check
                  :class="[
                    'ml-auto h-4 w-4 flex-shrink-0',
                    selected === country.id ? 'opacity-100' : 'opacity-0',
                  ]"
                />
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <Loader2 v-if="saving" class="h-4 w-4 animate-spin text-muted-foreground" />
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { e_player_roles_enum } from "~/generated/zeus";
import { getAllCountries } from "countries-and-timezones";
import { toast } from "@/components/ui/toast";

export default {
  inheritAttrs: false,
  props: {
    player: {
      type: Object,
      required: true,
    },
  },
  emits: ["updated"],
  data() {
    return {
      open: false,
      saving: false,
      selected: undefined as string | undefined,
      countries: getAllCountries(),
    };
  },
  watch: {
    player: {
      immediate: true,
      handler(player) {
        if (player) this.selected = player.country ?? undefined;
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canChangeCountry() {
      if (!this.me || !this.player) return false;
      return (
        this.player.steam_id === this.me.steam_id ||
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    countryList() {
      return Object.values(this.countries).sort((a: any, b: any) =>
        a.name.localeCompare(b.name),
      );
    },
  },
  methods: {
    async save() {
      if (!this.selected || this.selected === this.player.country) return;
      this.saving = true;
      try {
        await this.$apollo.mutate({
          variables: { country: this.selected },
          mutation: generateMutation({
            update_players_by_pk: [
              {
                pk_columns: { steam_id: this.player.steam_id },
                _set: { country: $("country", "String!") },
              },
              { steam_id: true, country: true },
            ],
          }),
        });
        toast({ title: this.$t("pages.settings.account.update_success") });
        this.$emit("updated", this.selected);
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
