<script setup lang="ts">
import { computed } from 'vue'

import type { JsonSchema } from '@/api'
import UiAddButton from '@/components/ui/UiAddButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import {
  emptyValue,
  getPath,
  isNumeric,
  isObjectSchema,
  labelFromPath,
  orderedProperties,
  type Values,
} from '@/domain/schema'
import { useWizardStore } from '@/stores/wizard'

defineOptions({ name: 'SchemaFields' })

const props = defineProps<{
  /** An object schema whose properties are rendered. */
  schema: JsonSchema
  /** Path of this object inside the form values; [] for the root. */
  path?: (string | number)[]
}>()

const wizard = useWizardStore()
const base = computed(() => props.path ?? [])

type Block =
  | { kind: 'fields'; entries: [string, JsonSchema][] }
  | { kind: 'section'; key: string; schema: JsonSchema }
  | { kind: 'array'; key: string; schema: JsonSchema }

/** Consecutive scalars share one grid; objects and arrays get their own titled block. */
const blocks = computed<Block[]>(() => {
  const result: Block[] = []
  for (const [key, child] of orderedProperties(props.schema)) {
    if (isObjectSchema(child)) result.push({ kind: 'section', key, schema: child })
    else if (child.type === 'array') result.push({ kind: 'array', key, schema: child })
    else {
      const last = result[result.length - 1]
      if (last?.kind === 'fields') last.entries.push([key, child])
      else result.push({ kind: 'fields', entries: [[key, child]] })
    }
  }
  return result
})

const dotted = (path: (string | number)[]) => path.join('.')

function valueAt(path: (string | number)[]): unknown {
  return getPath(wizard.values, path)
}

function text(path: (string | number)[]): string {
  const value = valueAt(path)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

/**
 * Row fields inside arrays never show "optional": the server's schema does not declare which row
 * fields are required, and a row without a title or rate is not meaningful.
 */
function isRequired(key: string, schema: JsonSchema = props.schema): boolean {
  return (
    base.value.some((segment) => typeof segment === 'number') ||
    (schema.required?.includes(key) ?? false)
  )
}

function label(key: string, child: JsonSchema): string {
  return child.title ?? labelFromPath(key)
}

function optionLabel(value: string | number): string {
  const s = String(value)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "Deliverables" → "deliverable", for the add buttons and row labels. */
function singular(title: string): string {
  return title.replace(/ies$/i, 'y').replace(/s$/i, '').toLowerCase()
}

function inputType(key: string, child: JsonSchema): 'text' | 'email' | 'tel' | 'date' | 'time' {
  if (child.format === 'email') return 'email'
  if (child.format === 'date') return 'date'
  if (child.format === 'time' || /time$/i.test(key)) return 'time'
  if (/phone|whatsapp/i.test(key)) return 'tel'
  return 'text'
}

function isLongText(key: string, child: JsonSchema): boolean {
  return key === 'content' || key === 'terms' || (key === 'description' && child['x-column'] === 2)
}

const booleanOptions = (child: JsonSchema) =>
  /percent/i.test(child.title ?? '')
    ? [
        { value: 'true', label: '%' },
        { value: 'false', label: 'Flat ₹' },
      ]
    : [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ]

function colSpan(child: JsonSchema): string {
  return child['x-column'] === 2 ? 'col-span-2' : ''
}

function set(path: (string | number)[], value: unknown) {
  wizard.setValue(path, value)
}

function addItem(path: (string | number)[], items: JsonSchema | undefined) {
  const current = valueAt(path)
  const list = Array.isArray(current) ? current : []
  set(path, [...list, items ? emptyValue(items) : ''])
}

function removeItem(path: (string | number)[], index: number) {
  const current = valueAt(path)
  if (Array.isArray(current)) {
    set(
      path,
      current.filter((_, i) => i !== index),
    )
  }
}

function listOf(path: (string | number)[]): unknown[] {
  const value = valueAt(path)
  return Array.isArray(value) ? value : []
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <template
      v-for="block in blocks"
      :key="block.kind === 'fields' ? block.entries[0]?.[0] : block.key"
    >
      <!-- Scalars -->
      <div v-if="block.kind === 'fields'" class="grid grid-cols-2 gap-3">
        <template v-for="[key, child] in block.entries" :key="key">
          <UiSelect
            v-if="child.enum && child.enum.length > 3"
            :model-value="text([...base, key]) as string"
            :label="label(key, child)"
            :options="child.enum.map(String)"
            :class="colSpan(child)"
            @update:model-value="(v) => set([...base, key], v)"
          />
          <UiSegmentedControl
            v-else-if="child.enum"
            :model-value="text([...base, key])"
            :label="label(key, child)"
            :options="child.enum.map((v) => ({ value: String(v), label: optionLabel(v) }))"
            :class="colSpan(child)"
            @update:model-value="(v) => set([...base, key], v)"
          />
          <UiSegmentedControl
            v-else-if="child.type === 'boolean'"
            :model-value="String(valueAt([...base, key]) === true)"
            :label="label(key, child)"
            :options="booleanOptions(child)"
            :class="colSpan(child)"
            @update:model-value="(v) => set([...base, key], v === 'true')"
          />
          <UiTextField
            v-else
            :model-value="text([...base, key])"
            :label="label(key, child)"
            :hint="isRequired(key) ? undefined : 'optional'"
            :type="inputType(key, child)"
            :numeric="isNumeric(child)"
            :multiline="isLongText(key, child)"
            :rows="6"
            :error="wizard.fieldErrors[dotted([...base, key])]"
            :class="colSpan(child)"
            @update:model-value="(v) => set([...base, key], v ?? '')"
          />
        </template>
      </div>

      <!-- Nested object -->
      <section v-else-if="block.kind === 'section'" class="flex flex-col gap-3">
        <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">
          {{ block.schema['x-section'] ?? block.schema.title ?? labelFromPath(block.key) }}
        </h3>
        <SchemaFields :schema="block.schema" :path="[...base, block.key]" />
      </section>

      <!-- Arrays -->
      <section v-else class="flex flex-col gap-3">
        <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">
          {{ block.schema['x-section'] ?? block.schema.title ?? labelFromPath(block.key) }}
        </h3>

        <template v-for="(item, index) in listOf([...base, block.key])" :key="index">
          <div
            v-if="block.schema.items && isObjectSchema(block.schema.items)"
            class="flex flex-col gap-3"
          >
            <SchemaFields :schema="block.schema.items" :path="[...base, block.key, index]" />
            <button
              v-if="listOf([...base, block.key]).length > 1"
              type="button"
              class="self-start text-xs font-semi-bold text-light-400 hover:text-white"
              @click="removeItem([...base, block.key], index)"
            >
              Remove {{ singular(block.schema.title ?? block.key) }} {{ index + 1 }}
            </button>
          </div>
          <div v-else class="flex items-end gap-2">
            <UiTextField
              class="flex-1"
              :model-value="typeof item === 'string' ? item : ''"
              :label="`${optionLabel(singular(block.schema.title ?? block.key))} ${index + 1}`"
              :hint="isRequired(block.key) ? undefined : 'optional'"
              :error="wizard.fieldErrors[dotted([...base, block.key, index])]"
              @update:model-value="(v) => set([...base, block.key, index], v ?? '')"
            />
            <button
              v-if="listOf([...base, block.key]).length > 1"
              type="button"
              class="pb-2.5 text-xs font-semi-bold text-light-400 hover:text-white"
              :aria-label="`Remove ${singular(block.schema.title ?? block.key)} ${index + 1}`"
              @click="removeItem([...base, block.key], index)"
            >
              Remove
            </button>
          </div>
        </template>

        <UiAddButton @click="addItem([...base, block.key], block.schema.items)">
          Add {{ singular(block.schema.title ?? block.key) }}
        </UiAddButton>
      </section>
    </template>
  </div>
</template>