<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
</script>

<template></template>

<script lang="ts">
export default {
  props: {
    form: {
      type: Object,
      required: true,
    },
    availableMaps: {
      type: Object,
      required: true,
    },
  },
  methods: {
    updateMapPool(mapId: string) {
      console.log(`updateMapPool`, mapId);
    },
  },
};
</script>
