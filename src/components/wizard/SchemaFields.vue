<script setup lang="ts">
import { NotArrayField, NotField } from 'notform'
import { computed } from 'vue'

import type { JsonSchema } from '@/api'
import DecorPicker from '@/components/wizard/DecorPicker.vue'
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
  singularLabel,
} from '@/domain/schema'
import { useWizardStore } from '@/stores/wizard'

defineOptions({ name: 'SchemaFields' })

const props = defineProps<{
  schema: JsonSchema
  path?: (string | number)[]
}>()

const wizard = useWizardStore()
const base = computed(() => props.path ?? [])

type Block =
  | { kind: 'fields'; entries: [string, JsonSchema][] }
  | { kind: 'section'; key: string; schema: JsonSchema }
  | { kind: 'array'; key: string; schema: JsonSchema }

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

function rowsFor(key: string): number {
  return key === 'content' || key === 'terms' ? 24 : 6
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

function messageFor(errors: { message: string }[], path: (string | number)[]): string | undefined {
  return errors[0]?.message ?? wizard.externalErrors[dotted(path)]
}

function noun(schema: JsonSchema, key: string): string {
  return singularLabel(schema.title ?? key)
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <template
      v-for="block in blocks"
      :key="block.kind === 'fields' ? block.entries[0]?.[0] : block.key"
    >
      <div v-if="block.kind === 'fields'" class="grid grid-cols-2 gap-3">
        <template v-for="[key, child] in block.entries" :key="key">
          <NotField v-slot="{ errors, events }" :path="dotted([...base, key])">
            <DecorPicker
              v-if="child['x-widget']"
              :model-value="text([...base, key])"
              :label="label(key, child)"
              :widget="child['x-widget']"
              :decor-slot="child['x-decor-slot']"
              :hint="isRequired(key) ? undefined : 'optional'"
              :error="messageFor(errors, [...base, key])"
              :class="'col-span-2'"
              @update:model-value="(v) => set([...base, key], v)"
            />
            <UiSelect
              v-else-if="child.enum && child.enum.length > 3"
              :model-value="text([...base, key])"
              :label="label(key, child)"
              :options="child.enum.map(String)"
              :class="colSpan(child)"
              @update:model-value="
                (v) => {
                  set([...base, key], v)
                  events.onChange()
                }
              "
            />
            <UiSegmentedControl
              v-else-if="child.enum"
              :model-value="text([...base, key])"
              :label="label(key, child)"
              :options="child.enum.map((v) => ({ value: String(v), label: optionLabel(v) }))"
              :class="colSpan(child)"
              @update:model-value="
                (v) => {
                  set([...base, key], v)
                  events.onChange()
                }
              "
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
              :rows="rowsFor(key)"
              :readonly="wizard.isAutoLocked(dotted([...base, key]))"
              :suffix="wizard.isAutoLocked(dotted([...base, key])) ? 'Auto' : undefined"
              :error="messageFor(errors, [...base, key])"
              :class="colSpan(child)"
              @update:model-value="(v) => set([...base, key], v ?? '')"
              @focusout="events.onBlur"
              @change="events.onChange"
              @input="events.onInput"
            />
          </NotField>
        </template>
      </div>

      <section v-else-if="block.kind === 'section'" class="flex flex-col gap-3">
        <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">
          {{ block.schema['x-section'] ?? block.schema.title ?? labelFromPath(block.key) }}
        </h3>
        <SchemaFields :schema="block.schema" :path="[...base, block.key]" />
      </section>

      <NotArrayField
        v-else
        v-slot="{ items, append, remove, errors: listErrors }"
        :path="dotted([...base, block.key])"
      >
        <section class="flex flex-col gap-3">
          <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">
            {{ block.schema['x-section'] ?? block.schema.title ?? labelFromPath(block.key) }}
          </h3>

          <template v-for="item in items" :key="item.key">
            <div
              v-if="block.schema.items && isObjectSchema(block.schema.items)"
              class="flex flex-col gap-3"
            >
              <SchemaFields :schema="block.schema.items" :path="[...base, block.key, item.index]" />
              <button
                v-if="items.length > 1"
                type="button"
                class="self-start text-xs font-semi-bold text-light-400 hover:text-white"
                @click="remove(item.index)"
              >
                Remove {{ noun(block.schema, block.key).toLowerCase() }} {{ item.index + 1 }}
              </button>
            </div>
            <NotField v-else v-slot="{ errors, events }" :path="item.path">
              <div class="flex items-end gap-2">
                <UiTextField
                  class="flex-1"
                  :model-value="text([...base, block.key, item.index])"
                  :label="`${noun(block.schema, block.key)} ${item.index + 1}`"
                  :hint="isRequired(block.key) ? undefined : 'optional'"
                  :error="messageFor(errors, [...base, block.key, item.index])"
                  @update:model-value="(v) => set([...base, block.key, item.index], v ?? '')"
                  @focusout="events.onBlur"
                  @change="events.onChange"
                  @input="events.onInput"
                />
                <button
                  v-if="items.length > 1"
                  type="button"
                  class="pb-2.5 text-xs font-semi-bold text-light-400 hover:text-white"
                  :aria-label="`Remove ${noun(block.schema, block.key).toLowerCase()} ${item.index + 1}`"
                  @click="remove(item.index)"
                >
                  Remove
                </button>
              </div>
            </NotField>
          </template>

          <p v-if="listErrors[0]" class="text-xs text-alert-400" role="alert">
            {{ listErrors[0].message }}
          </p>

          <UiAddButton @click="append(block.schema.items ? emptyValue(block.schema.items) : '')">
            Add {{ noun(block.schema, block.key).toLowerCase() }}
          </UiAddButton>
        </section>
      </NotArrayField>
    </template>
  </div>
</template>