<script setup lang="ts">
import { computed } from 'vue'

import {
  levelFor,
  setLevel,
  setScope,
  TERM_LEVELS,
  TERM_TEMPLATES,
  termScope,
  type TermLevel,
  type TermScope,
} from '@/domain/terms'

interface Lists {
  appliesTo: string[]
  defaultFor: string[]
  requiredFor: string[]
}

const model = defineModel<Lists>({ required: true })

const scope = computed(() => termScope(model.value))
const levels = computed(() =>
  scope.value === 'any' ? TERM_LEVELS.filter((level) => level.id !== 'off') : TERM_LEVELS,
)
const ids = TERM_TEMPLATES.map((template) => template.id)

const scopes: readonly { id: TermScope; label: string }[] = [
  { id: 'any', label: 'Any template' },
  { id: 'selected', label: 'Selected templates' },
]

const pick = (templateId: string, level: TermLevel) =>
  (model.value = setLevel(model.value, templateId, level))
const pickScope = (next: TermScope) => (model.value = setScope(model.value, next, ids))

const chip = (active: boolean) =>
  active ? 'bg-white text-dark-400' : 'text-light-400 hover:text-white'
</script>

<template>
  <fieldset class="flex flex-col gap-3">
    <legend class="text-sm font-semi-bold text-light-600">Templates</legend>
    <p class="text-xs text-light-400">
      Required terms are always included; defaults are pre-selected and can be removed.
    </p>

    <div role="radiogroup" aria-label="Offered on" class="flex gap-1 rounded-md bg-dark-500 p-1">
      <button
        v-for="option in scopes"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="scope === option.id"
        class="flex-1 rounded-sm px-2 py-1 text-xs font-semi-bold"
        :class="chip(scope === option.id)"
        @click="pickScope(option.id)"
      >
        {{ option.label }}
      </button>
    </div>

    <ul class="flex flex-col gap-2">
      <li v-for="template in TERM_TEMPLATES" :key="template.id" class="flex flex-col gap-1">
        <span class="text-sm">{{ template.label }}</span>
        <div
          role="radiogroup"
          :aria-label="`${template.label} level`"
          class="flex gap-1 rounded-md bg-dark-500 p-1"
        >
          <button
            v-for="level in levels"
            :key="level.id"
            type="button"
            role="radio"
            :title="level.hint"
            :aria-checked="levelFor(model, template.id) === level.id"
            class="flex-1 rounded-sm px-1.5 py-1 text-xs font-semi-bold"
            :class="chip(levelFor(model, template.id) === level.id)"
            @click="pick(template.id, level.id)"
          >
            {{ level.label }}
          </button>
        </div>
      </li>
    </ul>
  </fieldset>
</template>