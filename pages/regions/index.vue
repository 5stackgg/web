<script setup lang="ts">
import { Plus } from "lucide-vue-next";
import { useMediaQuery } from "@vueuse/core";
import { Button } from "~/components/ui/button";
import AdminSearch from "~/components/admin/AdminSearch.vue";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import SlideSwap from "~/components/ui/transitions/SlideSwap.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import RegionForm from "~/components/regions/RegionForm.vue";
import RegionList from "~/components/regions/RegionList.vue";
import RegionDetail from "~/components/regions/RegionDetail.vue";
import {
  createButtonClasses,
  listCreateButtonClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({ middleware: "admin" });

// Below lg the list and the detail don't fit side by side: the detail is
// pushed over the list and a back button pans back.
const wide = useMediaQuery("(min-width: 1024px)");
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.regions.title") }}</h1>

  <PageTransition>
    <div class="grid w-full max-w-[64rem] gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <AdminSearch
          v-model="search"
          shortcut
          :placeholder="$t('pages.regions.search_placeholder')"
        />

        <Button
          size="sm"
          :class="[listCreateButtonClasses, 'ml-auto']"
          :title="$t('pages.regions.create_sheet.title')"
          @click="createOpen = true"
        >
          <Plus class="size-4" />
          <span class="max-md:sr-only">{{
            $t("pages.regions.create_sheet.title")
          }}</span>
        </Button>
      </div>

      <FadeSwap>
        <SectionEmpty
          v-if="view && view.length === 0"
          key="empty"
          :title="$t('pages.regions.empty.title')"
          :description="$t('pages.regions.empty.description')"
        >
          <Button :class="createButtonClasses" @click="createOpen = true">
            <Plus />
            {{ $t("pages.regions.create_sheet.title") }}
          </Button>
        </SectionEmpty>

        <div
          v-else-if="wide"
          key="wide"
          class="grid min-h-[420px] grid-cols-[17rem_minmax(0,1fr)]"
        >
          <RegionList
            :regions="filtered"
            :selected-value="selected?.value"
            @select="select"
            @move="selectedValue = $event"
          />
          <div class="region-swap pl-6">
            <Transition name="region-swap">
              <RegionDetail
                v-if="selected"
                :key="selected.value"
                :region="selected"
                @rename="renameSelected"
                @set-flag="setSelectedFlag"
                @delete="confirmDelete"
              />
              <SectionEmpty
                v-else-if="view"
                key="no-match"
                class="max-w-[720px] self-start"
                :title="$t('common.empty_filtered.title')"
                :description="$t('common.empty_filtered.description')"
              >
                <Button variant="outline" size="sm" @click="search = ''">
                  {{ $t("common.clear_filters") }}
                </Button>
              </SectionEmpty>
            </Transition>
          </div>
        </div>

        <SlideSwap v-else key="narrow" :index="pushed ? 1 : 0">
          <RegionDetail
            v-if="pushed && selected"
            key="detail"
            :region="selected"
            pushed
            @back="showDetail = false"
            @rename="renameSelected"
            @set-flag="setSelectedFlag"
            @delete="confirmDelete"
          />
          <div v-else key="list">
            <SectionEmpty
              v-if="filtered && filtered.length === 0"
              :title="$t('common.empty_filtered.title')"
              :description="$t('common.empty_filtered.description')"
            >
              <Button variant="outline" size="sm" @click="search = ''">
                {{ $t("common.clear_filters") }}
              </Button>
            </SectionEmpty>
            <RegionList
              v-else
              :regions="filtered"
              :selected-value="selected?.value"
              @select="select"
              @move="selectedValue = $event"
            />
          </div>
        </SlideSwap>
      </FadeSwap>
    </div>
  </PageTransition>

  <Sheet v-model:open="createOpen">
    <SheetContent class="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader>
        <SheetTitle>{{ $t("pages.regions.create_sheet.title") }}</SheetTitle>
      </SheetHeader>
      <div class="py-6">
        <RegionForm @updated="onCreated" />
      </div>
    </SheetContent>
  </Sheet>

  <AlertDialog v-model:open="deleteOpen">
    <AlertDialogContent v-if="deleteTarget">
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.regions.delete_dialog.title", {
            region: labelOf(deleteTarget),
          })
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.regions.delete_dialog.description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <!-- Plain Button, not AlertDialogAction: the action auto-closes the
             dialog before the mutation lands. -->
        <Button variant="destructive" @click="deleteRegion">
          {{ $t("pages.regions.delete_dialog.confirm") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { order_by } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";
import {
  matchesRegionSearch,
  regionLabel,
  regionViewDefaults,
  regionViewValidators,
} from "~/components/regions/regionStatus";
import {
  readRememberedView,
  saveRememberedView,
} from "~/composables/useRememberedView";

type Region = {
  value: string;
  description: string | null;
  status: string | null;
  steam_relay: boolean;
  is_lan: boolean;
  available_server_count: number | null;
  total_server_count: number | null;
  game_server_nodes: Array<Record<string, any>>;
};

type RegionField = "steam_relay" | "is_lan" | "description";

export default {
  data() {
    // Back where it was left: the same search and the same region open.
    const view = readRememberedView(
      "regions",
      regionViewDefaults(),
      regionViewValidators,
    );
    return {
      regions: undefined as Region[] | undefined,
      search: view.search,
      selectedValue: view.selected,
      showDetail: false,
      createOpen: false,
      // A snapshot, so the dialog keeps its text while it animates shut.
      deleteTarget: null as Region | null,
      deleteOpen: false,
      // Switches and renames show their new value at once; the entry is
      // dropped once the subscription has caught up with the write.
      overlay: {} as Record<string, Partial<Pick<Region, RegionField>>>,
      settled: [] as Array<[string, RegionField]>,
    };
  },
  apollo: {
    $subscribe: {
      regions: {
        query: generateSubscription({
          server_regions: [
            { order_by: [{ value: order_by.asc }] },
            {
              value: true,
              description: true,
              is_lan: true,
              status: true,
              steam_relay: true,
              total_server_count: true,
              available_server_count: true,
              game_server_nodes: [
                { order_by: [{ label: order_by.asc }, { id: order_by.asc }] },
                {
                  id: true,
                  label: true,
                  status: true,
                  offline_at: true,
                  enabled: true,
                  enabled_for_match_making: true,
                  available_server_count: true,
                  total_server_count: true,
                },
              ],
            },
          ],
        }),
        result: function ({ data }: { data: any }) {
          this.regions = data.server_regions;
          for (const [value, field] of this.settled) {
            this.dropOverlay(value, field);
          }
          this.settled = [];
        },
      },
    },
  },
  watch: {
    rememberedView() {
      saveRememberedView(
        "regions",
        { search: this.search, selected: this.selectedValue },
        regionViewDefaults(),
      );
    },
  },
  computed: {
    rememberedView(): string {
      return JSON.stringify([this.search, this.selectedValue]);
    },
    view(): Region[] | undefined {
      return this.regions?.map((region: Region) =>
        this.overlay[region.value]
          ? { ...region, ...this.overlay[region.value] }
          : region,
      );
    },
    filtered(): Region[] | undefined {
      return this.view?.filter((region: Region) =>
        matchesRegionSearch(region, this.search),
      );
    },
    // Follows the search: a region the search hides hands the detail to the
    // first one it shows.
    selected(): Region | null {
      const list = this.filtered || [];
      return (
        list.find((region: Region) => region.value === this.selectedValue) ||
        list[0] ||
        null
      );
    },
    pushed(): boolean {
      return this.showDetail && !!this.selected;
    },
  },
  methods: {
    labelOf(region: Region): string {
      return regionLabel(region);
    },
    confirmDelete() {
      if (!this.selected) {
        return;
      }
      this.deleteTarget = this.selected;
      this.deleteOpen = true;
    },
    renameSelected(label: string) {
      if (this.selected) {
        void this.rename(this.selected, label);
      }
    },
    setSelectedFlag(field: "steam_relay" | "is_lan", value: boolean) {
      if (this.selected) {
        void this.setFlag(this.selected, field, value);
      }
    },
    select(value: string) {
      this.selectedValue = value;
      this.showDetail = true;
    },
    applyOverlay(value: string, fields: Partial<Pick<Region, RegionField>>) {
      this.overlay = {
        ...this.overlay,
        [value]: { ...this.overlay[value], ...fields },
      };
    },
    dropOverlay(value: string, field: RegionField) {
      const entry = { ...this.overlay[value] };
      delete entry[field];
      const next = { ...this.overlay, [value]: entry };
      if (Object.keys(entry).length === 0) {
        delete next[value];
      }
      this.overlay = next;
    },
    async updateRegion(
      region: Region,
      set: Partial<Pick<Region, RegionField>>,
      shown: Partial<Pick<Region, RegionField>> = set,
    ): Promise<boolean> {
      this.applyOverlay(region.value, shown);
      const keys = Object.keys(shown) as RegionField[];
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_server_regions_by_pk: [
              { pk_columns: { value: region.value }, _set: set },
              { value: true },
            ],
          }),
        });
      } catch {
        // The app already toasts GraphQL errors; snap back to the real value.
        keys.forEach((field) => this.dropOverlay(region.value, field));
        return false;
      }
      const live = this.regions?.find(
        (row: Region) => row.value === region.value,
      );
      keys.forEach((field) => {
        if (live && live[field] === shown[field]) {
          this.dropOverlay(region.value, field);
        } else {
          this.settled.push([region.value, field]);
        }
      });
      return true;
    },
    async setFlag(
      region: Region,
      field: "steam_relay" | "is_lan",
      value: boolean,
    ) {
      const set = { [field]: value };
      // The api turns the relay off when LAN only goes on; show that now.
      const shown =
        field === "is_lan" && value && region.steam_relay
          ? { ...set, steam_relay: false }
          : set;
      if (!(await this.updateRegion(region, set, shown))) {
        return;
      }
      const key =
        field === "steam_relay"
          ? value
            ? "pages.regions.toasts.relay_on"
            : "pages.regions.toasts.relay_off"
          : value
            ? "pages.regions.toasts.lan_on"
            : "pages.regions.toasts.lan_off";
      toast({ title: this.$t(key, { region: regionLabel(region) }) });
    },
    async rename(region: Region, label: string) {
      if (await this.updateRegion(region, { description: label || null })) {
        toast({ title: this.$t("pages.regions.toasts.label_saved") });
      }
    },
    async deleteRegion() {
      const target = this.deleteTarget;
      if (!target) {
        return;
      }
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            delete_server_regions_by_pk: [
              { value: target.value },
              { value: true },
            ],
          }),
        });
      } catch {
        // The app already toasts GraphQL errors (a region matches were played
        // in is refused by its foreign keys).
        return;
      }

      if (this.selected?.value === target.value) {
        const list = this.filtered || [];
        const index = list.findIndex(
          (region: Region) => region.value === target.value,
        );
        const neighbour = list[index + 1] || list[index - 1];
        this.selectedValue = neighbour?.value ?? null;
        this.showDetail = false;
      }
      this.deleteOpen = false;
      toast({
        title: this.$t("pages.regions.toasts.deleted", {
          region: regionLabel(target),
        }),
      });
    },
    onCreated(values?: { value?: string; description?: string }) {
      this.createOpen = false;
      if (!values?.value) {
        return;
      }
      if (
        !matchesRegionSearch(
          { value: values.value, description: values.description },
          this.search,
        )
      ) {
        this.search = "";
      }
      this.selectedValue = values.value;
      this.showDetail = true;
      toast({
        title: this.$t("pages.regions.toasts.created", {
          region: values.description?.trim() || values.value,
        }),
      });
    },
  },
};
</script>

<style scoped>
/* The leaving detail and the entering one share one cell, so the swap is a
   cross-fade in place rather than a stack. */
.region-swap {
  display: grid;
  min-width: 0;
}
.region-swap > * {
  grid-area: 1 / 1;
}
.region-swap-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.region-swap-leave-active {
  transition: opacity 110ms ease-in;
  pointer-events: none;
}
.region-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.region-swap-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .region-swap-enter-active,
  .region-swap-leave-active {
    transition-duration: 1ms;
  }
}
</style>
