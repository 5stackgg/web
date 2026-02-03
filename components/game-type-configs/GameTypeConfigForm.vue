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
import * as monaco from "monaco-editor";
</script>

<template>
  <form @submit.prevent="submitForm" class="space-y-4">
    <FormField name="cfg" v-slot="{ componentField }">
      <FormItem>
        <FormLabel for="cfg">{{ $t("game_type_configs.form.cfg") }}</FormLabel>
        <FormControl>
          <div class="border rounded-md overflow-hidden" style="height: 400px">
            <div ref="editorContainer" class="w-full h-full" />
          </div>
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
  setup() {
    const editorContainer = ref<HTMLElement | null>(null);
    const editorInstance = ref<monaco.editor.IStandaloneCodeEditor | null>(
      null,
    );
    const colorMode = useColorMode();

    return {
      editorContainer,
      editorInstance,
      colorMode,
    };
  },
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
  mounted() {
    this.$nextTick(() => {
      this.createEditor();
    });
  },
  beforeUnmount() {
    this.destroyEditor();
  },
  watch: {
    "colorMode.value"(newMode: string) {
      if (this.editorInstance) {
        monaco.editor.setTheme(newMode === "dark" ? "vs-dark" : "vs");
      }
    },
  },
  methods: {
    createEditor() {
      if (!this.editorContainer || !this.gameTypeConfig?.cfg) return;

      const theme = this.colorMode.value === "dark" ? "vs-dark" : "vs";

      this.editorInstance = monaco.editor.create(this.editorContainer, {
        value: this.gameTypeConfig.cfg,
        language: "plaintext",
        theme,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        tabSize: 2,
        wordWrap: "on",
      });
    },
    destroyEditor() {
      if (this.editorInstance) {
        this.editorInstance.dispose();
        this.editorInstance = null;
      }
    },
    getEditorValue() {
      return this.editorInstance?.getValue() || "";
    },
    async submitForm() {
      const cfgValue = this.getEditorValue();

      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_match_type_cfgs: [
              {
                objects: [
                  {
                    type: this.gameTypeConfig.type,
                    cfg: cfgValue,
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

        if (this.editorInstance) {
          this.editorInstance.setValue(defaultConfig);
        }

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
