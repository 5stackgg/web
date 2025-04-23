<script setup lang="ts"></script>

<template>
  <div
    class="text-blue-500 text-sm hover:underline cursor-pointer w-fit"
    @click.prevent="showRequestNameChangeDialog = true"
    v-if="canChangeName"
  >
    {{ $t("player.change_name.button") }}
  </div>
  <AlertDialog :open="showRequestNameChangeDialog">
    <AlertDialogTrigger asChild> </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            canUpdate
              ? $t("player.change_name.title")
              : $t("player.change_name.request_title")
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{
            canUpdate
              ? $t("player.change_name.description")
              : $t("player.change_name.request_description")
          }}

          <FormField v-slot="{ componentField }" name="player_name">
            <FormItem>
              <FormLabel>{{ $t("player.change_name.name_label") }}</FormLabel>
              <FormControl>
                <Input v-bind="componentField" />
              </FormControl>
            </FormItem>
          </FormField>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel @click="showRequestNameChangeDialog = false">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <AlertDialogAction
          @click="canUpdate ? changeName() : requestNameChange()"
        >
          {{ $t("common.confirm") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { z } from "zod";
import { toTypedSchema } from "@vee-validate/zod";
import { $ } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    player: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      showRequestNameChangeDialog: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            player_name: z.string().min(3).max(32),
          }),
        ),
      }),
    };
  },
  methods: {
    async changeName() {
      await this.$apollo.mutate({
        variables: {
          player_name: this.form.values.player_name,
        },
        mutation: generateMutation({
          update_players_by_pk: [
            {
              pk_columns: { steam_id: this.player.steam_id },
              _set: {
                name: $("player_name", "String!"),
              },
            },
            {
              steam_id: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("player.change_name.success"),
      });

      this.showRequestNameChangeDialog = false;
    },
    async requestNameChange() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      await this.$apollo.mutate({
        variables: {
          player_name: this.form.values.player_name,
        },
        mutation: generateMutation({
          requestNameChange: [
            {
              steam_id: this.player.steam_id,
              name: $("player_name", "String!"),
            },
            {
              success: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("player.change_name.request_success"),
      });

      this.showRequestNameChangeDialog = false;
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    canUpdate() {
      return !useAuthStore().isUser;
    },
    canChangeName() {
      if (!this.me) {
        return false;
      }
      return this.player.steam_id === this.me.steam_id || this.isAdmin;
    },
  },
};
</script>
