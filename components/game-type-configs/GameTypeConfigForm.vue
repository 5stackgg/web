<script setup lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-vue-next";
</script>

<template>
  <form @submit.prevent="submitForm" class="space-y-4">
    <FormField name="cfg" v-slot="{ componentField }">
      <FormItem>
        <FormLabel for="cfg">{{ $t("game_type_configs.form.cfg") }}</FormLabel>
        <FormControl>
          <Textarea
            v-bind="componentField"
            id="cfg"
            name="cfg"
            required
            rows="10"
          />
        </FormControl>
      </FormItem>
    </FormField>

    <div class="flex justify-between items-center">
      <Button type="submit">{{
        gameTypeConfig
          ? $t("game_type_configs.form.update")
          : $t("game_type_configs.form.create")
      }}</Button>
      <AlertDialog v-if="gameTypeConfig">
        <AlertDialogTrigger asChild>
          <Button variant="destructive" type="button">
            <Trash class="mr-2 h-4 w-4" />
            {{ $t("game_type_configs.form.revert_to_defaults") }}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{
              $t("game_type_configs.form.revert_confirm.title")
            }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{ $t("game_type_configs.form.revert_confirm.description") }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{
              $t("game_type_configs.form.revert_confirm.cancel")
            }}</AlertDialogCancel>
            <AlertDialogAction @click="revertToDefaults" variant="destructive">
              {{ $t("game_type_configs.form.revert_confirm.confirm") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </form>
</template>

<script lang="ts">
export default {
  props: {
    gameTypeConfig: {
      type: Object,
      required: false,
    },
  },
  emits: ["updated", "created", "deleted"],
  data() {
    return {
      verifiredMapName: false,
      isLoading: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            cfg: z.string().min(1),
          }),
        ),
        initialValues: this.gameTypeConfig
          ? {
              cfg: this.gameTypeConfig.cfg,
            }
          : undefined,
      }),
    };
  },
  methods: {
    async submitForm() {
      const values = this.form.values;

      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_match_type_cfgs: [
              {
                objects: [
                  {
                    type: this.gameTypeConfig.type,
                    cfg: values.cfg,
                  },
                ],
                on_conflict: {
                  constraint: "match_type_cfgs_pkey",
                  update_columns: ["cfg"],
                },
              },
              {
                affected_rows: true,
              },
            ],
          }),
        });

        toast({
          title: this.gameTypeConfig
            ? this.$t("game_type_configs.form.success.update")
            : this.$t("game_type_configs.form.success.create"),
        });

        this.$emit(this.gameTypeConfig ? "updated" : "created");
      } catch (error) {
        toast({
          title: this.gameTypeConfig
            ? this.$t("game_type_configs.form.error.update")
            : this.$t("game_type_configs.form.error.create"),
          variant: "destructive",
        });
      }
    },
    async revertToDefaults() {
      try {
        const defaultConfig = await this.getDefaultConfig(
          this.gameTypeConfig.type,
        );
        this.form.setFieldValue("cfg", defaultConfig);

        await this.submitForm();

        toast({
          title: this.$t("game_type_configs.form.success.revert"),
        });

        this.$emit("updated");
      } catch (error) {
        toast({
          title: this.$t("game_type_configs.form.error.revert"),
          variant: "destructive",
        });
      }
    },
    async getDefaultConfig(type: string): Promise<string> {
      return await $fetch<string>(`/api/get-default-config?type=${type}`);
    },
  },
};
</script>
