<script setup lang="ts">
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Calendar as CalendarIcon } from "lucide-vue-next";
import { RangeCalendar } from "@/components/ui/range-calendar";
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
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const formSectionClasses =
  "rounded-lg border border-border bg-card/40 p-5 [backdrop-filter:blur(6px)]";
</script>

<template>
  <form @submit.prevent="submitEvent" class="grid gap-6">
    <section :class="formSectionClasses">
      <div :class="[tacticalSectionLabelClasses]">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("event.form.sections.details") }}
      </div>

      <div class="grid gap-4">
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
      </div>
    </section>

    <section :class="formSectionClasses">
      <div :class="[tacticalSectionLabelClasses]">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("event.form.sections.schedule") }}
      </div>

      <div class="grid gap-4">
        <FormField name="starts_at">
          <FormItem class="flex flex-col">
            <FormLabel>{{ $t("event.form.dates") }}</FormLabel>
            <Popover>
              <PopoverTrigger as-child>
                <FormControl>
                  <Button
                    variant="outline"
                    class="w-[280px] justify-start text-left font-normal"
                    :class="{ ['text-muted-foreground']: !startDate }"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    {{ dateRangeLabel || $t("event.form.pick_dates") }}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <RangeCalendar
                  v-model="dateRange"
                  :number-of-months="2"
                  initial-focus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- The time inputs are plain v-model state, not vee-validate fields,
             so they must not use FormLabel/FormControl (useFormField throws
             outside a <FormField>). -->
        <div class="grid grid-cols-2 gap-4">
          <div class="grid gap-2">
            <Label
              class="font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
              for="event-start-time"
            >
              {{ $t("event.form.start_time") }}
            </Label>
            <Input
              id="event-start-time"
              type="time"
              v-model="startTime"
              style="color-scheme: dark"
            />
          </div>

          <div class="grid gap-2">
            <Label
              class="font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
              for="event-end-time"
            >
              {{ $t("event.form.end_time") }}
            </Label>
            <Input
              id="event-end-time"
              type="time"
              v-model="endTime"
              style="color-scheme: dark"
            />
          </div>
        </div>
      </div>
    </section>

    <section :class="formSectionClasses">
      <div :class="[tacticalSectionLabelClasses]">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("event.form.sections.access") }}
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField v-slot="{ componentField }" name="visibility">
          <FormItem>
            <FormLabel>{{ $t("event.form.visibility") }}</FormLabel>
            <FormControl>
              <Select v-bind="componentField">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('event.form.visibility')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="visibility in visibilityOptions"
                    :key="visibility.value"
                    :value="visibility.value"
                  >
                    {{ visibility.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="media_access">
          <FormItem>
            <FormLabel>{{ $t("event.form.media_access") }}</FormLabel>
            <FormControl>
              <Select v-bind="componentField">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('event.form.media_access')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="access in mediaAccessOptions"
                    :key="access.value"
                    :value="access.value"
                  >
                    {{ access.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </section>

    <!-- create page: clearance for the floating bar (the settings tab adds
         its own after the membership panel) -->
    <div v-if="!event" class="pb-24"></div>

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
import {
  $,
  e_event_visibility_enum,
  e_event_media_access_enum,
} from "~/generated/zeus";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { fromDate, toCalendarDate } from "@internationalized/date";
import { toast } from "@/components/ui/toast";

// `object` carries name/description/starts_at/ends_at/visibility/media_access.
// `organizer_steam_id` is a Hasura session preset on insert and must never be
// submitted from here.
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
        visibility: $("visibility", "e_event_visibility_enum"),
        media_access: $("media_access", "e_event_media_access_enum"),
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
            // Required: a start date bounds which of an attached team's or
            // player's matches count as the event's. Without it the event
            // would gather their entire match history (lifetime stats), not
            // just matches played during the event. The end date stays
            // optional — an ongoing event captures matches up to today.
            starts_at: z
              .date({
                required_error: this.$t("event.form.start_required") as string,
                invalid_type_error: this.$t(
                  "event.form.start_required",
                ) as string,
              })
              .refine((date) => date instanceof Date, {
                message: this.$t("event.form.start_required") as string,
              }),
            ends_at: z.date().nullable().default(null),
            visibility: z.string().default(e_event_visibility_enum.Public),
            media_access: z
              .string()
              .default(e_event_media_access_enum.Organizers),
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
    // Bridge between the RangeCalendar's DateRange model and the existing
    // startDate/endDate CalendarDate state, so the date/time watchers keep
    // driving starts_at/ends_at unchanged.
    dateRange: {
      get(this: any) {
        return { start: this.startDate, end: this.endDate };
      },
      set(this: any, range: any) {
        this.startDate = range?.start ?? undefined;
        this.endDate = range?.end ?? undefined;
      },
    },
    dateRangeLabel(this: any): string {
      if (!this.startDate) {
        return "";
      }
      if (
        !this.endDate ||
        this.endDate.toString() === this.startDate.toString()
      ) {
        return this.startDate.toString();
      }
      return `${this.startDate} → ${this.endDate}`;
    },
    createValid(): boolean {
      // Create flow gate: name and starts_at are the fields without a usable
      // schema default (starts_at is required so the event scopes to matches
      // played from that date on), so require both filled and no outstanding
      // validation errors.
      const values = this.form.values;
      return (
        Object.keys(this.form.errors).length === 0 &&
        !!values.name &&
        !!values.starts_at
      );
    },
    visibilityOptions() {
      return Object.values(e_event_visibility_enum).map((visibility) => ({
        value: visibility,
        label: this.$t(`event.visibility.${visibility.toLowerCase()}`),
      }));
    },
    mediaAccessOptions() {
      return Object.values(e_event_media_access_enum).map((access) => ({
        value: access,
        label: this.$t(`event.media_access.${access.toLowerCase()}`),
      }));
    },
  },
  methods: {
    populateFromEvent(event: any) {
      if (event.starts_at) {
        const startDate = new Date(event.starts_at);
        this.startDate = toCalendarDate(
          fromDate(startDate, Intl.DateTimeFormat().resolvedOptions().timeZone),
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
        visibility: event.visibility,
        media_access: event.media_access,
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
              visibility: values.visibility,
              media_access: values.media_access,
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
              visibility: values.visibility,
              media_access: values.media_access,
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
