<script setup lang="ts">
import { isVNode } from "vue"
import { Toast, ToastClose, ToastCopy, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "."
import { useToast } from "./use-toast"

const { toasts } = useToast()

// Build the clipboard payload — title + description, but only when the
// description is a plain string (VNode/component descriptions can't be
// stringified meaningfully).
function copyText(toast: { title?: unknown; description?: unknown }): string {
  const title = typeof toast.title === "string" ? toast.title : ""
  const desc =
    typeof toast.description === "string" ? toast.description : ""
  return [title, desc].filter(Boolean).join("\n\n")
}
</script>

<template>
  <ToastProvider>
    <Toast v-for="toast in toasts" :key="toast.id" v-bind="toast" :class="'pr-12'">
      <div class="grid gap-1">
        <ToastTitle v-if="toast.title" class="select-text break-words">
          {{ toast.title }}
        </ToastTitle>
        <template v-if="toast.description">
          <ToastDescription v-if="isVNode(toast.description)">
            <component :is="toast.description" />
          </ToastDescription>
          <ToastDescription v-else class="select-text whitespace-pre-wrap break-words">
            {{ toast.description }}
          </ToastDescription>
        </template>
        <ToastCopy
          v-if="copyText(toast)"
          :text="copyText(toast)"
        />
        <ToastClose />
      </div>
      <component :is="toast.action" />
    </Toast>
    <ToastViewport />
  </ToastProvider>
</template>
