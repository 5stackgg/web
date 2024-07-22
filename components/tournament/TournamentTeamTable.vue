<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Roster</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="{ player } of team.roster">
        <TableCell class="font-medium">
          <Avatar class="mx-3">
            <AvatarImage
              :src="player.avatar_url"
              :alt="player.name"
              v-if="player.avatar_url"
            />
            <AvatarFallback>{{ player.name }}</AvatarFallback>
          </Avatar>
          <p>{{ player.name }}</p>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
export default {
  props: {
    team: {
      type: Object,
      required: true,
    },
  },
};
</script>
