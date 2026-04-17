<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Loader2 } from "lucide-vue-next";
</script>

<template>
  <form
    v-if="canChangeName"
    class="flex items-center gap-2"
    @submit.prevent="save"
  >
    <Input
      v-model="name"
      maxlength="32"
      :placeholder="$t('player.change_name.name_label')"
      class="flex-1 min-w-0"
    />
    <Button
      type="submit"
      size="sm"
      :disabled="saving || !isValid || name === player.name"
    >
      <Loader2 v-if="saving" class="mr-1 h-4 w-4 animate-spin" />
      {{ $t("common.save") }}
    </Button>
  </form>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";
import { e_player_roles_enum } from "~/generated/zeus";

export default {
  inheritAttrs: false,
  props: {
    player: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      name: "",
      saving: false,
    };
  },
  watch: {
    player: {
      immediate: true,
      handler(player) {
        if (player) this.name = player.name;
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canChangeName() {
      return (
        this.player?.steam_id === this.me?.steam_id ||
        useAuthStore().isRoleAbove(e_player_roles_enum.administrator)
      );
    },
    mustRequestNameChange() {
      return !useAuthStore().isRoleAbove(e_player_roles_enum.administrator);
    },
    isValid() {
      const trimmed = (this.name || "").trim();
      return trimmed.length >= 3 && trimmed.length <= 32;
    },
  },
  methods: {
    async save() {
      if (!this.isValid || this.saving) return;
      this.saving = true;
      try {
        if (this.mustRequestNameChange) {
          await this.$apollo.mutate({
            variables: { player_name: this.name },
            mutation: generateMutation({
              requestNameChange: [
                {
                  steam_id: this.player.steam_id,
                  name: $("player_name", "String!"),
                },
                { success: true },
              ],
            }),
          });
          toast({ title: this.$t("player.change_name.request_success") });
        } else {
          await this.$apollo.mutate({
            variables: { player_name: this.name },
            mutation: generateMutation({
              update_players_by_pk: [
                {
                  pk_columns: { steam_id: this.player.steam_id },
                  _set: { name: $("player_name", "String!") },
                },
                { steam_id: true },
              ],
            }),
          });
          toast({ title: this.$t("player.change_name.success") });
        }
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
