<script setup lang="ts">
import { Pencil, Trash } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import GameTypeConfigForm from "~/components/game-type-configs/GameTypeConfigForm.vue";
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
</script>

<template>
  <TableRow :key="gameConfig.type" class="cursor-pointer">
    <TableCell class="font-medium">
      <div class="flex justify-between items-center align-middle pr-4">
        <span>{{ gameConfig.type }}</span>
      </div>
    </TableCell>
    <TableCell>
      <pre>{{ gameConfig.cfg }}</pre>
    </TableCell>
    <TableCell>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="secondary" size="icon">
            <PaginationEllipsis class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56">
          <DropdownMenuItem @click="editGameConfigSheet = true">
            <Pencil class="mr-2 h-4 w-4" />
            <span>{{ $t("game_type_configs.form.edit") }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="deleteGameConfigDialog = true"
            class="text-destructive"
          >
            <Trash class="mr-2 h-4 w-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>

  <Sheet
    :open="editGameConfigSheet"
    @update:open="(open) => (editGameConfigSheet = open)"
  >
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("game_type_configs.form.update") }}</SheetTitle>
        <SheetDescription>
          <GameTypeConfigForm
            :game-type-config="gameConfig"
            @created="editGameConfigSheet = false"
            @updated="editGameConfigSheet = false"
            @deleted="editGameConfigSheet = false"
          />
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>

  <AlertDialog
    :open="deleteGameConfigDialog"
    @update:open="(open) => (deleteGameConfigDialog = open)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Game Type Config</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete the config for {{ gameConfig.type }}?
          This will revert it to default values.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="deleteGameConfig" variant="destructive">
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { e_game_cfg_types_enum } from "~/generated/zeus";

export default defineComponent({
  props: {
    gameConfig: {
      type: Object as () => { type: string; cfg: string },
      required: true,
    },
  },
  data() {
    return {
      editGameConfigSheet: false,
      deleteGameConfigDialog: false,
    };
  },
  methods: {
    async deleteGameConfig() {
      try {
        await (this.$apollo as any).mutate({
          mutation: generateMutation({
            delete_match_type_cfgs_by_pk: [
              {
                type: this.gameConfig.type as e_game_cfg_types_enum,
              },
              {
                type: true,
              },
            ],
          }),
        });

        toast({
          title: "Config deleted successfully",
          description: `The config for ${this.gameConfig.type} has been deleted and will revert to defaults.`,
        });

        this.deleteGameConfigDialog = false;
      } catch (error) {
        console.error("Error deleting game type config:", error);
        toast({
          title: "Error deleting config",
          description: "Failed to delete the config. Please try again.",
          variant: "destructive",
        });
      }
    },
  },
});
</script>
