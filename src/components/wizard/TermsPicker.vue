<script setup lang="ts">
import IconArrowDown from '~icons/lucide/arrow-down'
import IconArrowUp from '~icons/lucide/arrow-up'
import IconLock from '~icons/lucide/lock'
import IconX from '~icons/lucide/x'

import type { JsonSchema } from '@/api'
import UiAddButton from '@/components/ui/UiAddButton.vue'
import {
  addTerm,
  availableTerms,
  isLocked,
  moveTerm,
  removeTerm,
  selectedSlugs,
  termTitle,
} from '@/domain/terms'

const props = defineProps<{
  schema: JsonSchema
  modelValue: unknown
  error?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const chosen = () => selectedSlugs(props.modelValue)
const update = (next: string[]) => emit('update:modelValue', next)
</script>

<template>
  <div class="flex flex-col gap-3">
    <ol v-if="chosen().length > 0" class="flex flex-col gap-2" aria-label="Selected terms">
      <li
        v-for="(slug, index) in chosen()"
        :key="slug"
        class="flex items-center gap-2 rounded-md border border-dark-600 bg-dark-500 px-3 py-2"
      >
        <span class="w-5 text-xs text-light-400" aria-hidden="true">{{ index + 1 }}</span>
        <span class="min-w-0 flex-1 truncate text-sm text-white">
          {{ termTitle(schema, slug) }}
        </span>
        <span
          v-if="isLocked(schema, slug)"
          class="inline-flex items-center gap-1 text-xs text-light-400"
        >
          <IconLock class="size-3" aria-hidden="true" />
          Required
        </span>
        <button
          type="button"
          class="rounded-sm p-1 text-light-400 outline-none hover:text-white focus-visible:shadow-focus-ring disabled:opacity-30"
          :disabled="index === 0"
          :aria-label="`Move ${termTitle(schema, slug)} up`"
          @click="update(moveTerm(chosen(), index, index - 1))"
        >
          <IconArrowUp class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="rounded-sm p-1 text-light-400 outline-none hover:text-white focus-visible:shadow-focus-ring disabled:opacity-30"
          :disabled="index === chosen().length - 1"
          :aria-label="`Move ${termTitle(schema, slug)} down`"
          @click="update(moveTerm(chosen(), index, index + 1))"
        >
          <IconArrowDown class="size-4" aria-hidden="true" />
        </button>
        <button
          v-if="!isLocked(schema, slug)"
          type="button"
          class="rounded-sm p-1 text-light-400 outline-none hover:text-white focus-visible:shadow-focus-ring"
          :aria-label="`Remove ${termTitle(schema, slug)}`"
          @click="update(removeTerm(chosen(), slug, schema))"
        >
          <IconX class="size-4" aria-hidden="true" />
        </button>
      </li>
    </ol>
    <p v-else class="text-sm text-light-400">No terms selected.</p>

    <div
      v-if="availableTerms(schema, chosen()).length > 0"
      class="flex flex-wrap gap-x-4 gap-y-1"
      role="group"
      aria-label="Available terms"
    >
      <UiAddButton
        v-for="option in availableTerms(schema, chosen())"
        :key="option.slug"
        @click="update(addTerm(chosen(), option.slug))"
      >
        {{ option.title }}
      </UiAddButton>
    </div>

    <p v-if="error" class="text-xs text-alert-400" role="alert">{{ error }}</p>
  </div>
</template>