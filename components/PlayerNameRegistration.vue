<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-vue-next";
</script>

<template>
  <AlertDialog :open="requiredPlayerNameRegistration">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Register your name</AlertDialogTitle>
        <AlertDialogDescription class="space-y-4">
          <p>
            This name will be used for all matches / tournaments you participate
            in.
          </p>

          <p
            class="text-red-500 font-medium italic border border-red-300 rounded-md p-3 bg-red-50 flex items-center gap-2"
          >
            <AlertCircle class="w-5 h-5" />
            This name cannot be changed after being submitted
          </p>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <form @submit.prevent="confirmName" class="flex flex-col gap-4">
        <FormField v-slot="{ componentField }" name="player_name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input v-bind="componentField" />
            </FormControl>
          </FormItem>
        </FormField>

        <Button type="submit">Confirm Name</Button>
      </form>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useForm } from "vee-validate";
import { z } from "zod";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { $ } from "~/generated/zeus";

export default {
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            player_name: z.string().min(3).max(32),
          }),
        ),
      }),
    };
  },
  watch: {
    me: {
      immediate: true,
      handler() {
        if (!this.me) {
          return;
        }

        this.form.setValues({
          player_name: this.me.name,
        });
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    playerNameRegistration() {
      return useApplicationSettingsStore().playerNameRegistration;
    },
    requiredPlayerNameRegistration() {
      return this.me?.name_registered === false;
    },
  },
  methods: {
    async confirmName() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      const form = this.form.values;

      await this.$apollo.mutate({
        variables: {
          name: form.player_name,
        },
        mutation: generateMutation({
          registerName: [
            {
              name: $("name", "String!"),
            },
            {
              success: true,
            },
          ],
        }),
      });

      toast({
        title: "Name confirmed",
      });
    },
  },
};
</script>
