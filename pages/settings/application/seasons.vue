<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-6">
      <div class="space-y-0.5">
        <h3 class="text-lg font-medium">Seasons</h3>
        <p class="text-sm text-muted-foreground">
          Manage competitive seasons. Regular match ELO resets to 5000 each
          season.
        </p>
      </div>

      <!-- Create Season Form -->
      <AnimatedCard variant="gradient" class="p-6" v-if="!activeSeason">
        <h4 class="text-base font-medium mb-4">Create New Season</h4>
        <form @submit.prevent="createSeason" class="space-y-4">
          <div class="space-y-2">
            <Label for="season-name">Season Name</Label>
            <Input
              id="season-name"
              v-model="newSeasonName"
              placeholder="e.g. Season 1"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="season-start">Start Date</Label>
            <Input
              id="season-start"
              type="datetime-local"
              v-model="newSeasonStartsAt"
              required
            />
          </div>
          <Button type="submit" :disabled="!newSeasonName || !newSeasonStartsAt">
            Create Season
          </Button>
        </form>
      </AnimatedCard>

      <!-- Active Season Notice -->
      <AnimatedCard
        variant="gradient"
        class="p-6"
        v-if="activeSeason"
      >
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="text-base font-medium">{{ activeSeason.name }}</h4>
              <Badge variant="default">Active</Badge>
            </div>
            <p class="text-sm text-muted-foreground">
              Started {{ formatDate(activeSeason.starts_at) }}
            </p>
          </div>
          <Button variant="destructive" @click="endSeason(activeSeason.id)">
            End Season
          </Button>
        </div>
      </AnimatedCard>

      <!-- Seasons List -->
      <AnimatedCard variant="gradient" class="p-6" v-if="pastSeasons.length > 0">
        <h4 class="text-base font-medium mb-4">Past Seasons</h4>
        <div class="space-y-3">
          <div
            v-for="season in pastSeasons"
            :key="season.id"
            class="flex items-center justify-between p-3 rounded-md bg-muted/50"
          >
            <div class="space-y-0.5">
              <span class="font-medium">{{ season.name }}</span>
              <p class="text-sm text-muted-foreground">
                {{ formatDate(season.starts_at) }} &mdash;
                {{ formatDate(season.ends_at) }}
              </p>
            </div>
          </div>
        </div>
      </AnimatedCard>

      <div
        v-if="!activeSeason && pastSeasons.length === 0"
        class="text-center py-8 text-muted-foreground"
      >
        No seasons created yet. Create your first season above.
      </div>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  apollo: {
    $subscribe: {
      seasons: {
        query: typedGql("subscription")({
          seasons: [
            {
              order_by: [
                {
                  starts_at: order_by.desc,
                },
              ],
            },
            {
              id: true,
              name: true,
              starts_at: true,
              ends_at: true,
              created_at: true,
            },
          ],
        }),
        result: function ({ data }: { data: any }) {
          this.seasons = data.seasons || [];
        },
      },
    },
  },
  data() {
    return {
      seasons: [] as Array<{
        id: string;
        name: string;
        starts_at: string;
        ends_at: string | null;
        created_at: string;
      }>,
      newSeasonName: "",
      newSeasonStartsAt: "",
    };
  },
  computed: {
    activeSeason() {
      return this.seasons.find((s) => !s.ends_at) || null;
    },
    pastSeasons() {
      return this.seasons.filter((s) => s.ends_at);
    },
  },
  methods: {
    formatDate(date: string) {
      if (!date) return "";
      return new Date(date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
    async createSeason() {
      if (this.activeSeason) {
        toast({
          title: "Cannot create season while one is active",
          variant: "destructive",
        });
        return;
      }

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_seasons_one: [
              {
                object: {
                  name: this.newSeasonName,
                  starts_at: new Date(this.newSeasonStartsAt).toISOString(),
                },
              },
              {
                id: true,
              },
            ],
          }),
        });

        this.newSeasonName = "";
        this.newSeasonStartsAt = "";

        toast({ title: "Season created successfully" });
      } catch (error) {
        toast({
          title: "Failed to create season",
          variant: "destructive",
        });
      }
    },
    async endSeason(seasonId: string) {
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_seasons_by_pk: [
              {
                pk_columns: { id: seasonId },
                _set: {
                  ends_at: new Date().toISOString(),
                },
              },
              {
                id: true,
              },
            ],
          }),
        });

        toast({ title: "Season ended successfully" });
      } catch (error) {
        toast({
          title: "Failed to end season",
          variant: "destructive",
        });
      }
    },
  },
};
</script>
