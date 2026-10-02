<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import { FormSection } from "~/components/ui/form";
import RegionLatencySettings from "~/components/matchmaking/RegionLatencySettings.vue";
</script>

<template>
  <div class="space-y-4">
    <FormSection
      :title="$t('pages.settings.matchmaking.show_match_ready_modal.title')"
    >
      <div class="flex items-center justify-between gap-4">
        <p class="flex-1 text-sm text-muted-foreground">
          {{
            $t("pages.settings.matchmaking.show_match_ready_modal.description")
          }}
        </p>
        <Switch
          :model-value="showMatchReadyModal"
          :disabled="!me"
          @update:model-value="updateShowMatchReadyModal"
        />
      </div>
    </FormSection>

    <RegionLatencySettings />
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { toast } from "@/components/ui/toast";

export default {
  methods: {
    async updateShowMatchReadyModal(value: boolean) {
      if (!this.me) return;
      await this.$apollo.mutate({
        variables: { show: value },
        mutation: generateMutation({
          update_players_by_pk: [
            {
              pk_columns: { steam_id: this.me.steam_id },
              _set: { show_match_ready_modal: $("show", "Boolean!") },
            },
            { steam_id: true, show_match_ready_modal: true },
          ],
        }),
      });
      toast({ title: this.$t("pages.settings.account.update_success") });
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    showMatchReadyModal(): boolean {
      return this.me?.show_match_ready_modal !== false;
    },
  },
};
</script>
