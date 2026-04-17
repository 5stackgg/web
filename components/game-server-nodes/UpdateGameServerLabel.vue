<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
</script>

<template>
  <Sheet :open="open" @update:open="(open) => open === false && $emit('close')">
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("game_server.edit_label") }}</SheetTitle>
        <SheetDescription>
          <div class="space-y-4">
            <div class="grid gap-6 p-4 bg-muted/50 rounded-lg">
              <div class="grid gap-2">
                <div class="font-semibold text-sm">ID</div>
                <div class="text-sm text-muted-foreground font-mono">
                  {{ gameServerNode.id }}
                </div>
              </div>
              <div class="grid gap-2">
                <div class="font-semibold text-sm">
                  {{ $t("common.region") }}
                </div>
                <div class="text-sm text-muted-foreground">
                  {{
                    gameServerNode.e_region?.description ||
                    gameServerNode.region
                  }}
                </div>
              </div>
              <div class="grid gap-2" v-if="gameServerNode.lan_ip">
                <div class="font-semibold text-sm">
                  {{ $t("game_server.lan_ip") }}
                </div>
                <div class="text-sm text-muted-foreground font-mono">
                  {{ gameServerNode.lan_ip }}
                </div>
              </div>
              <div class="grid gap-2" v-if="gameServerNode.public_ip">
                <div class="font-semibold text-sm">
                  {{ $t("game_server.public_ip") }}
                </div>
                <div class="text-sm text-muted-foreground font-mono">
                  {{ gameServerNode.public_ip }}
                </div>
              </div>
            </div>

            <form @submit.prevent="updateLabel" class="space-y-4 pt-4">
              <FormField v-slot="{ componentField }" name="label">
                <FormItem>
                  <FormControl>
                    <Input
                      v-bind="componentField"
                      :placeholder="$t('game_server.label_placeholder')"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
              <Button type="submit" class="w-full">{{
                $t("game_server.update_label")
              }}</Button>
            </form>
          </div>
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    open: {
      required: true,
      type: Boolean,
    },
    gameServerNode: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      editLabelSheet: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            label: z.string().optional(),
          }),
        ),
      }),
    };
  },
  watch: {
    gameServerNode: {
      immediate: true,
      handler(newVal) {
        this.form.setValues({
          label: newVal.label,
        });
      },
    },
  },
  methods: {
    async updateLabel() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                label: this.form.values.label,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.editLabelSheet = false;
      toast({
        title: this.$t("game_server.toast.label_updated"),
      });

      this.$emit("close");
    },
  },
};
</script>
