<script setup lang="ts">
import { Pencil } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import GameTypeConfigForm from "~/components/game-type-configs/GameTypeConfigForm.vue";
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
            <span>{{ $t("map_pools.edit_map") }}</span>
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
        <SheetTitle>{{ $t("pages.dedicated_servers.detail.edit") }}</SheetTitle>
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
</template>

<script lang="ts">
import { defineComponent } from "vue";

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
    };
  },
});
</script>
