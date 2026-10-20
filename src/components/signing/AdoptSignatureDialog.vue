<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import { fieldValues, missingText, type FieldPlan } from '@/domain/signing'

import SignaturePad from './SignaturePad.vue'

const props = defineProps<{
  open: boolean
  plan: FieldPlan
  busy: boolean
  error: string | null
}>()

const emit = defineEmits<{
  close: []
  adopt: [fields: Record<string, string>]
}>()

const signature = ref<string | null>(null)
const consent = ref(false)
const texts = reactive<Record<string, string>>({})
const attempted = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    signature.value = null
    consent.value = false
    attempted.value = false
    for (const key of Object.keys(texts)) delete texts[key]
  },
)

const missing = computed(() => missingText(props.plan, texts))
const ready = computed(
  () => signature.value !== null && consent.value && missing.value.length === 0,
)

function submit() {
  attempted.value = true
  if (!ready.value || !signature.value) return
  emit('adopt', fieldValues(props.plan, signature.value, texts))
}
</script>

<template>
  <UiDialog :open="open" title="Adopt your signature" @close="emit('close')">
    <SignaturePad v-model="signature" />

    <UiTextField
      v-for="field in plan.textFields"
      :key="field.id"
      v-model="texts[field.id]"
      :label="field.label"
      :error="
        attempted && !(texts[field.id] ?? '').trim() ? `${field.label} is required` : undefined
      "
    />

    <label class="flex items-start gap-2 text-xs text-light-500">
      <input v-model="consent" type="checkbox" class="mt-0.5 size-4 accent-accent-500" />
      I agree this is my legal signature and I consent to sign this document electronically.
    </label>

    <p v-if="attempted && !signature" class="text-xs text-alert-400" role="alert">
      Draw or upload your signature first.
    </p>
    <p v-if="error" class="rounded-md bg-alert-600 px-3 py-2 text-sm" role="alert">{{ error }}</p>

    <div class="flex justify-end gap-2">
      <UiButton variant="ghost" @click="emit('close')">Cancel</UiButton>
      <UiButton :disabled="busy" @click="submit">{{
        busy ? 'Signing…' : 'Adopt and sign'
      }}</UiButton>
    </div>
  </UiDialog>
</template>