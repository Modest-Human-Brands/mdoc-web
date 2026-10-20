<script setup lang="ts">
import { NotField, NotForm, useNotForm } from 'notform'
import { computed, ref } from 'vue'

import UiAddButton from '@/components/ui/UiAddButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import {
  addClient,
  clients,
  findClient,
  removeClient,
  updateClient,
} from '@/composables/useClients'
import { clientFormSchema } from '@/domain/clientForm'
import {
  clientInitials,
  clientSubtitle,
  emptyClient,
  type Client,
  type ClientDraft,
} from '@/domain/clients'
import { useWizardStore } from '@/stores/wizard'

const props = defineProps<{ keys: string[] }>()

const wizard = useWizardStore()
const selected = computed(() => findClient(wizard.clientId))

const open = ref(false)
const mode = ref<'list' | 'form'>('list')
const editingId = ref<string | null>(null)

const form = useNotForm({ schema: clientFormSchema, initialValues: emptyClient() })

function openDialog() {
  mode.value = clients.value.length === 0 ? 'form' : 'list'
  startForm(null)
  open.value = true
}

function startForm(client: Client | null) {
  editingId.value = client?.id ?? null
  const { id: _id, ...draft } = client ?? { id: '', ...emptyClient() }
  form.reset(draft)
}

function addNew() {
  startForm(null)
  mode.value = 'form'
}

function choose(client: Client) {
  wizard.selectClient(client, props.keys)
  open.value = false
}

function edit(client: Client) {
  startForm(client)
  mode.value = 'form'
}

function remove(client: Client) {
  removeClient(client.id)
  if (wizard.clientId === client.id) wizard.clearClient()
}

async function save() {
  const checked = await form.validate()
  if (checked.issues) return
  const draft: ClientDraft = {
    name: form.values.name.trim(),
    email: form.values.email.trim(),
    phone: form.values.phone.trim(),
    address: form.values.address.trim(),
  }
  const saved = editingId.value ? updateClient(editingId.value, draft) : addClient(draft)
  if (saved && (editingId.value === null || wizard.clientId === saved.id)) {
    wizard.selectClient(saved, props.keys)
  }
  open.value = false
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="text-sm font-semi-bold text-light-600">Client</span>
    <button
      type="button"
      class="flex min-h-14 items-center gap-3 rounded-md border border-dark-600 bg-dark-500 px-3 py-2 text-left outline-none hover:bg-dark-600 focus-visible:shadow-focus-ring"
      :class="selected ? 'border-accent-400' : ''"
      @click="openDialog"
    >
      <template v-if="selected">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-dark-600 text-xs font-semi-bold text-light-600"
          aria-hidden="true"
        >
          {{ clientInitials(selected.name) }}
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm font-semi-bold text-white">{{ selected.name }}</span>
          <span class="truncate text-xs text-light-400">{{ clientSubtitle(selected) }}</span>
        </span>
        <span class="text-xs font-semi-bold text-accent-400">Change</span>
      </template>
      <span v-else class="flex-1 text-sm text-light-400">Choose or add a client</span>
    </button>
    <p v-if="selected" class="text-xs text-light-400">
      Phone and address are filled in from the client.
    </p>

    <UiDialog
      :open="open"
      :title="mode === 'list' ? 'Clients' : editingId ? 'Edit client' : 'New client'"
      @close="open = false"
    >
      <template v-if="mode === 'list'">
        <ul class="flex max-h-72 flex-col gap-2 overflow-y-auto">
          <li
            v-for="client in clients"
            :key="client.id"
            class="flex items-center gap-2 rounded-md border border-dark-600 bg-dark-400 p-2"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:shadow-focus-ring"
              @click="choose(client)"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-dark-600 text-xs font-semi-bold text-light-600"
                aria-hidden="true"
              >
                {{ clientInitials(client.name) }}
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="truncate text-sm font-semi-bold">{{ client.name }}</span>
                <span class="truncate text-xs text-light-400">{{ clientSubtitle(client) }}</span>
              </span>
            </button>
            <button
              type="button"
              class="text-xs font-semi-bold text-light-400 hover:text-white"
              @click="edit(client)"
            >
              Edit
            </button>
            <button
              type="button"
              class="text-xs font-semi-bold text-light-400 hover:text-white"
              @click="remove(client)"
            >
              Delete
            </button>
          </li>
        </ul>
        <UiAddButton @click="addNew">Add client</UiAddButton>
        <div class="flex justify-end">
          <UiButton variant="ghost" @click="open = false">Close</UiButton>
        </div>
      </template>

      <NotForm v-else :form="form" class="flex flex-col gap-3" @submit.prevent="save">
        <NotField v-slot="{ errors, events }" path="name">
          <UiTextField
            v-model="form.values.name"
            label="Name"
            :error="errors[0]?.message"
            @focusout="events.onBlur"
            @input="events.onInput"
          />
        </NotField>
        <NotField v-slot="{ errors, events }" path="email">
          <UiTextField
            v-model="form.values.email"
            label="Email"
            hint="optional"
            type="email"
            :error="errors[0]?.message"
            @focusout="events.onBlur"
            @input="events.onInput"
          />
        </NotField>
        <UiTextField v-model="form.values.phone" label="Phone" hint="optional" type="tel" />
        <UiTextField
          v-model="form.values.address"
          label="Address"
          hint="optional"
          multiline
          :rows="3"
        />
        <div class="flex justify-end gap-2">
          <UiButton variant="ghost" @click="clients.length > 0 ? (mode = 'list') : (open = false)">
            Cancel
          </UiButton>
          <UiButton @click="save">Save client</UiButton>
        </div>
      </NotForm>
    </UiDialog>
  </div>
</template>