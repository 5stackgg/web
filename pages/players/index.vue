<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("pages.players.title") }}</template>
    </PageHeading>
    <Card class="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="flex items-center justify-between m-4">
              <span>{{ $t("pages.players.search") }}</span>

              <div>
                <form
                  class="flex-grow flex justify-end"
                  @submit.prevent="viewTopPlayer"
                >
                  <FormField name="playerQuery" v-slot="{ componentField }">
                    <FormItem>
                      <FormControl>
                        <div class="relative w-full max-w-sm">
                          <Input
                            type="text"
                            :placeholder="$t('pages.players.search')"
                            class="pl-10"
                            v-bind="componentField"
                          />
                          <Search
                            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5"
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  </FormField>
                </form>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="player of players"
            @click="viewPlayer(player.steam_id)"
            class="cursor-pointer"
          >
            <TableCell class="font-medium">
              <div class="flex">
                <PlayerDisplay :player="player"></PlayerDisplay>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <Pagination
      :page="page"
      :per-page="per_page"
      @page="
        (_page) => {
          page = _page;
        }
      "
      :total="pagination.total"
      v-if="pagination"
    ></Pagination>
  </div>
</template>

<script lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
export default {
  data() {
    return {
      page: 1,
      per_page: 10,
      players: undefined,
      pagination: undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            playerQuery: z.string(),
          }),
        ),
      }),
    };
  },
  watch: {
    page: {
      immediate: true,
      handler() {
        this.searchPlayers();
      },
    },
    "form.values.playerQuery": {
      immediate: true,
      handler() {
        this.page = 1;
        this.searchPlayers();
      },
    },
  },
  methods: {
    viewTopPlayer() {
      const player = this.players?.at(0);
      if (!player) {
        return;
      }

      this.viewPlayer(player.steam_id);
    },
    viewPlayer(steam_id) {
      this.$router.push(`/players/${steam_id}`);
    },
    async searchPlayers() {
      const response = await $fetch("/api/players-search", {
        method: "post",
        body: {
          page: this.page,
          query: this.form.values.playerQuery,
          per_page: this.per_page,
        },
      });

      const { found, hits } = response;

      this.pagination = {
        total: found,
      };

      this.players = hits.map(({ document }) => {
        return document;
      });
    },
  },
};
</script>
