<script setup lang="ts">
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Calendar as CalendarIcon } from "lucide-vue-next";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
</script>

<template>
  <form @submit.prevent="submitEvent" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="name">
      <FormItem>
        <FormLabel>{{ $t("event.form.name") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="description">
      <FormItem>
        <FormLabel>{{ $t("event.form.description") }}</FormLabel>
        <FormControl>
          <Textarea v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="starts_at">
      <FormItem>
        <FormLabel>{{ $t("event.form.starts_at") }}</FormLabel>
        <FormControl>
          <div class="flex">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  class="w-[280px] justify-start text-left font-normal"
                  :class="{
                    ['text-muted-foreground']: !componentField.modelValue,
                  }"
                >
                  <CalendarIcon class="mr-2 h-4 w-4" />
                  {{ startDate || $t("common.pick_date") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="startDate" initial-focus />
              </PopoverContent>
            </Popover>

            <Input
              type="time"
              v-model="startTime"
              style="color-scheme: dark"
            ></Input>
          </div>

          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="ends_at">
      <FormItem>
        <FormLabel>{{ $t("event.form.ends_at") }}</FormLabel>
        <FormControl>
          <div class="flex">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  class="w-[280px] justify-start text-left font-normal"
                  :class="{
                    ['text-muted-foreground']: !componentField.modelValue,
                  }"
                >
                  <CalendarIcon class="mr-2 h-4 w-4" />
                  {{ endDate || $t("common.pick_date") }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="endDate" initial-focus />
              </PopoverContent>
            </Popover>

            <Input
              type="time"
              v-model="endTime"
              style="color-scheme: dark"
            ></Input>
          </div>

          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <!-- Status is only ever editable once the event exists; on create it is
         always seeded to the default (Setup) by the database. -->
    <FormField v-if="event" v-slot="{ componentField }" name="status">
      <FormItem>
        <FormLabel>{{ $t("event.form.status") }}</FormLabel>
        <FormControl>
          <Select v-bind="componentField">
            <SelectTrigger>
              <SelectValue :placeholder="$t('event.form.status')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="status in statusOptions"
                :key="status.value"
                :value="status.value"
              >
                {{ status.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- spacer so content clears the floating bar -->
    <div class="pb-24"></div>

    <SettingsSaveBar
      v-if="event"
      :dirty="isDirty"
      :submitting="submitting"
      @save="submitEvent"
      @discard="discardChanges"
    />

    <SettingsSaveBar
      v-else
      force-visible
      hide-discard
      :valid="createValid"
      :submitting="submitting"
      :title="
        createValid
          ? $t('event.form.create_bar.ready')
          : $t('event.form.create_bar.incomplete')
      "
      :description="
        createValid
          ? $t('event.form.create_bar.ready_hint')
          : $t('event.form.create_bar.incomplete_hint')
      "
      :action-label="$t('event.form.create')"
      @save="submitEvent"
    />
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import { $, e_event_status_enum } from "~/generated/zeus";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { fromDate, toCalendarDate } from "@internationalized/date";
import { toast } from "@/components/ui/toast";

// `object` carries name/description/starts_at/ends_at only. `organizer_steam_id`
// is a Hasura session preset on insert and must never be submitted from here,
// and `status` is not an allowed insert column (it always starts at Setup).
const insertEvent = generateMutation({
  insert_events_one: [
    {
      object: $("object", "events_insert_input!"),
    },
    { id: true },
  ],
});

const updateEvent = generateMutation({
  update_events_by_pk: [
    {
      pk_columns: {
        id: $("id", "uuid!"),
      },
      _set: {
        name: $("name", "String!"),
        description: $("description", "String"),
        starts_at: $("starts_at", "timestamptz"),
        ends_at: $("ends_at", "timestamptz"),
        status: $("status", "e_event_status_enum"),
      },
    },
    {
      id: true,
    },
  ],
});

export default {
  emits: ["saved"],
  props: {
    event: {
      type: Object,
      required: false,
      default: null,
    },
  },
  data() {
    return {
      submitting: false,
      submitLock: false,
      baseline: null as string | null,
      isDirty: false,
      startDate: undefined,
      startTime: undefined,
      endDate: undefined,
      endTime: undefined,
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: toTypedSchema(
          z.object({
            name: z.string().min(1),
            description: z.string().nullable().default(null),
            starts_at: z.date().nullable().default(null),
            ends_at: z.date().nullable().default(null),
            status: z.string().nullable().default(null),
          }),
        ),
      }),
    };
  },
  watch: {
    startTime: {
      immediate: true,
      handler() {
        this.setStart();
      },
    },
    startDate: {
      immediate: true,
      handler() {
        this.setStart();
      },
    },
    endTime: {
      immediate: true,
      handler() {
        this.setEnd();
      },
    },
    endDate: {
      immediate: true,
      handler() {
        this.setEnd();
      },
    },
    event: {
      immediate: true,
      handler(event) {
        if (!event) {
          return;
        }
        // `event` may be backed by a live subscription that re-emits
        // periodically. Only (re)load the form from the server copy when the
        // user has no in-progress edits, otherwise a re-emit would wipe their
        // changes and reset the unsaved-changes bar.
        if (this.baseline === null || !this.isDirty) {
          this.populateFromEvent(event);
        }
      },
    },
    ["form.values"]: {
      deep: true,
      handler() {
        this.isDirty =
          this.baseline !== null &&
          JSON.stringify(this.form.values) !== this.baseline;
      },
    },
  },
  computed: {
    createValid(): boolean {
      // Create flow gate: the only field without a schema default is name, so
      // require it filled and no outstanding validation errors.
      const values = this.form.values;
      return Object.keys(this.form.errors).length === 0 && !!values.name;
    },
    statusOptions() {
      return Object.values(e_event_status_enum).map((status) => ({
        value: status,
        label: this.$t(`event.status.${status.toLowerCase()}`),
      }));
    },
  },
  methods: {
    populateFromEvent(event: any) {
      if (event.starts_at) {
        const startDate = new Date(event.starts_at);
        this.startDate = toCalendarDate(
          fromDate(
            startDate,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          ),
        );
        this.startTime = `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`;
      } else {
        this.startDate = undefined;
        this.startTime = undefined;
      }

      if (event.ends_at) {
        const endDate = new Date(event.ends_at);
        this.endDate = toCalendarDate(
          fromDate(endDate, Intl.DateTimeFormat().resolvedOptions().timeZone),
        );
        this.endTime = `${endDate.getHours().toString().padStart(2, "0")}:${endDate.getMinutes().toString().padStart(2, "0")}`;
      } else {
        this.endDate = undefined;
        this.endTime = undefined;
      }

      // starts_at/ends_at must be set (or cleared) here too: the date/time
      // watchers early-return when either part is undefined, so without this
      // a dateless event would keep a stale starts_at in form.values and
      // discarding a date edit would not restore the server value.
      this.form.setValues({
        name: event.name,
        description: event.description,
        status: event.status,
        starts_at: event.starts_at ? new Date(event.starts_at) : null,
        ends_at: event.ends_at ? new Date(event.ends_at) : null,
      });

      this.takeSnapshot();
    },
    takeSnapshot() {
      this.$nextTick(() => {
        this.baseline = JSON.stringify(this.form.values);
        this.isDirty = false;
      });
    },
    discardChanges() {
      if (this.event) {
        this.populateFromEvent(this.event);
      }
    },
    setStart() {
      if (!this.startDate || !this.startTime) {
        return;
      }
      this.form.setValues({
        starts_at: new Date(`${this.startDate} ${this.startTime}`),
      });
    },
    setEnd() {
      if (!this.endDate || !this.endTime) {
        return;
      }
      this.form.setValues({
        ends_at: new Date(`${this.endDate} ${this.endTime}`),
      });
    },
    async submitEvent() {
      if (this.submitLock) {
        return;
      }
      this.submitLock = true;

      let navigatingAway = false;

      try {
        const { valid, errors } = await this.form.validate();

        if (!valid) {
          toast({
            variant: "destructive",
            title: this.$t("common.error"),
            description: Object.values(errors ?? {})[0] as string,
          });
          return;
        }

        this.submitting = true;
        const values = this.form.values;

        if (this.event) {
          await (this as any).$apollo.mutate({
            variables: {
              id: this.event.id,
              name: values.name,
              description: values.description ?? null,
              starts_at: values.starts_at ?? null,
              ends_at: values.ends_at ?? null,
              status: values.status,
            },
            mutation: updateEvent,
          });

          toast({
            title: this.$t("event.updated") as string,
          });

          this.takeSnapshot();
          this.$emit("saved", this.event.id);
          return;
        }

        const { data } = await (this as any).$apollo.mutate({
          variables: {
            object: {
              name: values.name,
              description: values.description ?? null,
              starts_at: values.starts_at ?? null,
              ends_at: values.ends_at ?? null,
            },
          },
          mutation: insertEvent,
        });

        navigatingAway = true;
        this.$emit("saved", data.insert_events_one.id);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        if (!navigatingAway) {
          this.submitLock = false;
          this.submitting = false;
        }
      }
    },
  },
};
</script>
