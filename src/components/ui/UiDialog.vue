<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')

function sync() {
  const element = dialog.value
  if (!element) return
  if (props.open && !element.open) element.showModal()
  else if (!props.open && element.open) element.close()
}

watch(() => props.open, sync, { flush: 'post' })
onMounted(sync)
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-full max-w-120 rounded-xl border border-dark-600 bg-dark-500 p-0 text-white backdrop:bg-black/60"
    :aria-label="title"
    @close="emit('close')"
    @click.self="emit('close')"
  >
    <div class="flex flex-col gap-4 p-6">
      <h2 class="text-lg font-bold">{{ title }}</h2>
      <slot />
    </div>
  </dialog>
</template>