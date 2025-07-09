<template>
  <form
    v-if="variant === 'global'"
    class="border-t bg-background p-3 flex-shrink-0"
    @submit.prevent="sendMessage"
  >
    <FormField v-slot="{ componentField }" name="message">
      <FormItem>
        <FormControl>
          <div class="flex gap-2">
            <Input
              :placeholder="$t(placeholder)"
              v-bind="componentField"
              class="flex-1 transition-all duration-200 focus:scale-[1.02]"
            />
            <Button
              type="submit"
              size="sm"
              class="transition-all duration-200 hover:scale-105"
            >
              <CornerDownLeft class="size-3.5" />
            </Button>
          </div>
        </FormControl>
      </FormItem>
    </FormField>
  </form>
  <form
    v-else
    class="relative overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
    @submit.prevent="sendMessage"
  >
    <FormField v-slot="{ componentField }" name="message">
      <FormItem>
        <FormControl>
          <div class="p-3 flex justify-between">
            <Input
              :placeholder="$t(placeholder)"
              v-bind="componentField"
              class="resize-none border-0 p-3 shadow-none focus-visible:ring-0"
            />
            <Button type="submit" size="sm" class="ml-auto gap-1.5">
              <CornerDownLeft class="size-3.5" />
            </Button>
          </div>
        </FormControl>
      </FormItem>
    </FormField>
  </form>
</template>

<script lang="ts">
import { CornerDownLeft } from "lucide-vue-next";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";

export default {
  props: {
    variant: {
      type: String,
      default: "embedded",
      validator: (value: string) => ["global", "embedded"].includes(value),
    },
    placeholder: {
      type: String,
      default: "chat.message_placeholder",
    },
  },
  emits: ["sendMessage"],
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            message: z.string().min(1),
          }),
        ),
      }),
    };
  },
  methods: {
    sendMessage() {
      const { message } = this.form.values;
      if (!message || message?.length === 0) {
        return;
      }
      this.$emit("sendMessage", message);
      this.form.resetForm();
    },
  },
};
</script>
