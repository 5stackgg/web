<script setup lang="ts"></script>

<template>
  <div
    class="text-blue-500 text-sm hover:underline cursor-pointer"
    @click.prevent="showRequestNameChangeDialog = true"
    v-if="canChangeName"
  >
    Change Name
  </div>
  <AlertDialog :open="showRequestNameChangeDialog">
    <AlertDialogTrigger asChild> </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ canUpdate ? "Change Name" : "Request Name Change" }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{
            canUpdate
              ? "Please enter the name you would like to change to."
              : "Please enter the name you would like to change your account to."
          }}

          <FormField v-slot="{ componentField }" name="player_name">
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input v-bind="componentField" />
              </FormControl>
            </FormItem>
          </FormField>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel @click="showRequestNameChangeDialog = false">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          @click="canUpdate ? changeName() : requestNameChange()"
        >
          Confirm
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
        title: "Changed Players Name",
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
        title: "Requested Name Change",
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
