<script setup lang="ts">
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerDescription,
} from "~/components/ui/drawer";
import { Button } from "~/components/ui/button";
import {
  ChevronDownIcon,
  MicOff,
  MessageSquareOff,
  BellOff,
  Ban,
} from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { useForm } from "vee-validate";
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline">
        {{ $t("player.sanction.button") }}
        <ChevronDownIcon class="ml-2 h-4 w-4 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="p-0" align="end">
      <Command v-model="sanctionType">
        <CommandList>
          <CommandGroup>
            <template v-for="(sanction, type) in sanctions" :key="type">
              <CommandItem
                :value="type"
                @click="sanctioningPlayer = true"
                class="flex flex-col items-start px-4 py-2 cursor-pointer"
              >
                <div class="flex items-center gap-2">
                  <component :is="sanction.icon" class="h-4 w-4" />
                  <span class="font-medium capitalize">{{ type }}</span>
                </div>
                <p class="text-sm text-muted-foreground mt-1">
                  {{ sanction.description }}
                </p>
              </CommandItem>
            </template>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>

  <Drawer :open="sanctioningPlayer" @update:open="sanctioningPlayer = $event">
    <DrawerContent class="p-4">
      <DrawerHeader>
        <div class="flex justify-between items-center">
          <DrawerTitle class="capitalize flex flex-col gap-4">
            {{ sanctionType }}ing Player
            <PlayerDisplay :player="player" />
          </DrawerTitle>
          <DrawerClose>
            <Button variant="link" class="text-lg text-blue-500">
              Cancel
            </Button>
          </DrawerClose>
        </div>

        <Separator class="my-2" />

        <DrawerDescription
          class="text-lg flex gap-4 items-center text-red-500"
          v-if="sanctionType"
        >
          <component :is="sanctions[sanctionType].icon" class="h-4 w-4" />
          {{ sanctions[sanctionType].description }}
        </DrawerDescription>
        <Separator class="my-2" />
      </DrawerHeader>

      <form @submit.prevent="sanctionPlayer" class="grid grid-cols-2 gap-4 p-4">
        <FormField v-slot="{ componentField }" name="reason">
          <FormItem>
            <FormLabel>Reason</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                placeholder="Enter reason for sanction..."
              ></Input>
            </FormControl>
            <FormDescription>
              {{ $t("player.sanction.reason_description") }}
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="duration">
          <FormItem>
            <FormLabel>Duration</FormLabel>
            <FormControl>
              <Select v-bind="componentField">
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    :value="duration.duration.toString()"
                    v-for="duration in durations"
                    >{{ duration.label }}</SelectItem
                  >
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button class="capitalize" type="submit">
          {{ sanctionType }} Player
        </Button>
      </form>
    </DrawerContent>
  </Drawer>
</template>

<script lang="ts">
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    player: {
      required: true,
      type: Object,
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            reason: z.string().min(1),
            duration: z.string().min(1),
          }),
        ),
      }),
      sanctionType: undefined as string | undefined,
      sanctioningPlayer: false,
      sanctions: {
        ban: {
          icon: Ban,
          description: "Player is not able to participate in any activity",
        },
        mute: {
          icon: MicOff,
          description: "Player cannot use voice chat in game",
        },
        gag: {
          icon: MessageSquareOff,
          description: "Player cannot use text chat in game",
        },
        silence: {
          icon: BellOff,
          description: "Player muted and gagged",
        },
      },
      durations: [
        { label: "15 minutes", duration: 1000 * 60 * 15 },
        { label: "30 minutes", duration: 1000 * 60 * 30 },
        { label: "1 hour", duration: 1000 * 60 * 60 },
        { label: "1 day", duration: 1000 * 60 * 60 * 24 },
        { label: "1 week", duration: 1000 * 60 * 60 * 24 * 7 },
        { label: "1 month", duration: 1000 * 60 * 60 * 24 * 30 },
        { label: "Permanent", duration: 0 },
      ],
    };
  },
  methods: {
    async sanctionPlayer() {
      if (!this.sanctionType) {
        return;
      }

      let remove_sanction_date: Date | null = null;

      const currentDate = new Date();
      if (this.form.values.duration && this.form.values.duration !== "0") {
        remove_sanction_date = new Date(
          currentDate.getTime() + parseInt(this.form.values.duration),
        );
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_player_sanctions_one: [
            {
              object: {
                type: this.sanctionType,
                player_steam_id: this.player.steam_id,
                reason: this.form.values.reason,
                remove_sanction_date,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      toast({
        title: `${this.sanctionType}ed ${this.player.name}`,
      });

      this.sanctioningPlayer = false;
    },
  },
};
</script>