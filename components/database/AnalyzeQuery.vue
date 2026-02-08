<template>
  <pev2 :plan-source="plan" :plan-query="query"></pev2>
</template>

<script>
import { Plan } from "pev2";
import "pev2/dist/pev2.css";

export default {
  components: {
    pev2: Plan,
  },
  props: {
    plan: {
      type: String,
      required: true,
    },
    query: {
      type: String,
      required: true,
    },
  },
};
</script>
