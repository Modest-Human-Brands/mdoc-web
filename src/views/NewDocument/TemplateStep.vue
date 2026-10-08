<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { resolveApiUrl } from '@/api'

import UiButton from '@/components/ui/UiButton.vue'
import UiFilterChip from '@/components/ui/UiFilterChip.vue'
import UiTemplateCard from '@/components/ui/UiTemplateCard.vue'
import PreviewPanel from '@/components/wizard/PreviewPanel.vue'
import TemplateThumb from '@/components/wizard/TemplateThumb.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { useTemplates } from '@/composables/useTemplates'
import { categoryFilters } from '@/domain/templates'
import { STEPS, useWizardStore } from '@/stores/wizard'

const router = useRouter()
const wizard = useWizardStore()
const { templates, loading, error, reload } = useTemplates()

const filter = ref<string>('All')
const filters = computed(() => categoryFilters(templates.value))
const visible = computed(() =>
  templates.value.filter((t) => filter.value === 'All' || t.category === filter.value),
)
const selected = computed(() => templates.value.find((t) => t.id === wizard.templateId) ?? null)
const sampleUrl = computed(() => (selected.value ? resolveApiUrl(selected.value.sampleUrl) : null))

function toggle(id: string) {
  wizard.selectTemplate(wizard.templateId === id ? null : id)
}

async function next() {
  await router.push(STEPS[1].path)
}
</script>

<template>
  <WizardShell
    :step="0"
    title="Start from a template"
    subtitle="Pick one to preview it. You can switch any time before filling details."
  >
    <div class="flex flex-wrap gap-2" role="group" aria-label="Filter templates">
      <UiFilterChip
        v-for="item in filters"
        :key="item.id"
        :label="item.id"
        :count="item.count"
        :selected="filter === item.id"
        @click="filter = item.id"
      />
    </div>

    <p
      v-if="error"
      class="flex items-center justify-between gap-3 rounded-md bg-alert-600 px-3 py-2 text-sm text-white"
      role="alert"
    >
      Couldn't load templates: {{ error }}
      <button type="button" class="font-semi-bold underline" @click="reload">Retry</button>
    </p>

    <p v-else-if="loading" class="text-sm text-light-400" role="status">Loading templates…</p>

    <p v-else-if="templates.length === 0" class="text-sm text-light-400">
      No templates are registered on the server yet.
    </p>

    <div v-else class="grid grid-cols-3 gap-3">
      <UiTemplateCard
        v-for="template in visible"
        :key="template.id"
        :title="template.shortLabel"
        :category="template.category"
        :active="template.id === wizard.templateId"
        @click="toggle(template.id)"
      >
        <template #thumbnail>
          <TemplateThumb :url="resolveApiUrl(template.sampleUrl)" />
        </template>
      </UiTemplateCard>
    </div>

    <template #note>
      {{ selected ? `${selected.shortLabel} selected` : 'No template selected' }}
    </template>
    <template #actions>
      <UiButton v-if="selected" variant="ghost" @click="wizard.selectTemplate(null)">
        Choose another
      </UiButton>
      <UiButton :disabled="!selected" @click="next">Use this template</UiButton>
    </template>

    <template #preview>
      <PreviewPanel
        :label="selected ? `Preview · ${selected.shortLabel} · sample data` : 'Preview'"
        :url="sampleUrl"
        :download-name="selected ? `${selected.shortLabel} sample` : undefined"
        :reset-key="wizard.templateId"
      />
    </template>
  </WizardShell>
</template>