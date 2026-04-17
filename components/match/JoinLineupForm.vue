<script setup lang="ts">
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { UserPlusIcon } from "lucide-vue-next";
import { e_lobby_access_enum } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
</script>

<template>
  <form @submit.prevent="joinLineup" class="flex gap-4">
    <FormField
      v-slot="{ componentField }"
      name="code"
      v-if="match.options.lobby_access === e_lobby_access_enum.Invite"
    >
      <FormItem>
        <FormControl>
          <Input v-bind="componentField"></Input>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button variant="outline" class="flex gap-4">
      <UserPlusIcon class="h-4 w-4" />
      {{ $t("match.overview.join") }}
    </Button>
  </form>
</template>

<script lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    lineup: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            code: z.string().optional(),
          }),
        ),
      }),
    };
  },
  watch: {
    $route: {
      immediate: true,
      handler() {
        if (!this.$route.query.invite) {
          return;
        }
        this.form.setFieldValue("code", this.$route.query.invite);
      },
    },
  },
  methods: {
    async joinLineup() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          joinLineup: [
            {
              match_id: this.match.id,
              lineup_id: this.lineup.id,
              code: this.form.values.code || this.$route.query.invite || "",
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.$emit("joined");

      if (this.$route.query.invite) {
        const { invite, ...queryWithoutInvite } = this.$route.query;
        this.$router.replace({ query: queryWithoutInvite });
      }
    },
  },
};
</script>
