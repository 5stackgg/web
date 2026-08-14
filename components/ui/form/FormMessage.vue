<script lang="ts" setup>
import { useFormField } from "./useFormField"

const { formMessageId, error } = useFormField()
</script>

<template>
  <!-- The error folds the row open instead of mounting a bare paragraph --
       every field below used to jump ~28px (line box + the FormItem gap) on
       each blur/validate. The FormItem's space-y-2 puts a margin-top on this
       wrapper from outside, so the fold animates that away too. -->
  <Transition
    enter-active-class="form-message-fold"
    enter-from-class="form-message-fold-collapsed"
    leave-active-class="form-message-fold"
    leave-to-class="form-message-fold-collapsed"
  >
    <div v-if="error" class="grid grid-rows-[1fr]">
      <div class="min-h-0">
        <p
          :id="formMessageId"
          class="text-[0.8rem] font-medium text-destructive"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.form-message-fold {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}
.form-message-fold > * {
  overflow: hidden;
}
/* !important: Tailwind's space-y selector outspecifies a scoped class, and
   without the margin the collapse would end with an 8px snap. */
.form-message-fold-collapsed {
  grid-template-rows: 0fr;
  margin-top: 0 !important;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .form-message-fold {
    transition-duration: 1ms;
  }
}
</style>
