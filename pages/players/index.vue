<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { Separator } from "~/components/ui/separator";
import Pagination from "@/components/Pagination.vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "~/components/ui/button";
</script>

<template>
  <PageHeading> Players </PageHeading>
  <Separator class="my-6" />

  <div class="relative w-full max-w-sm items-center">
    <Input
      id="search"
      type="text"
      placeholder="Search..."
      class="pl-10"
      v-model="playerQuery"
    />
    <span
      class="absolute start-0 inset-y-0 flex items-center justify-center px-2"
    >
      <Search class="size-6 text-muted-foreground" />
    </span>
  </div>

  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[100px]"> Name </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow
        v-for="player of players"
        @click="viewPlayer(player.steam_id)"
        class="cursor-pointer"
      >
        <TableCell class="font-medium">
          <Avatar>
            <AvatarImage
              :src="player.avatar_url"
              :alt="player.name"
              v-if="player.avatar_url"
            />
            <AvatarFallback>{{ player.name }}</AvatarFallback>
          </Avatar>
          {{ player.name }}
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
  <Pagination
    :page="page"
    :per-page="per_page"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="Math.ceil(pagination.total / per_page)"
    v-if="pagination"
  ></Pagination>
</template>

<script lang="ts">
export default {
  data() {
    return {
      page: 1,
      per_page: 10,
      playerQuery: null,
      players: undefined,
      pagination: undefined,
    };
  },
  watch: {
    page: {
      immediate: true,
      handler() {
        this.searchPlayers();
      },
    },
    playerQuery: {
      handler() {
        this.searchPlayers();
      },
    },
  },
  methods: {
    viewPlayer(steam_id) {
      this.$router.push(`/players/${steam_id}`);
    },
    async searchPlayers() {
      const response = await useFetch("/api/players-search", {
        method: "post",
        body: {
          page: this.page,
          query: this.playerQuery,
          per_page: this.per_page,
        },
      });

      const { found, request_params } = response.data.value;

      this.pagination = {
        total: found,
      };

      this.players = response.data.value.hits.map(({ document }) => {
        return document;
      });
    },
  },
};
</script>
