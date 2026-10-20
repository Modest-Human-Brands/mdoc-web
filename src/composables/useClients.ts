import { useStorage } from '@vueuse/core'

import type { Client, ClientDraft } from '@/domain/clients'

export const clients = useStorage<Client[]>('mdoc.clients', [], undefined, {
  listenToStorageChanges: false,
})

export function findClient(id: string | null): Client | null {
  return id ? (clients.value.find((client) => client.id === id) ?? null) : null
}

export function addClient(draft: ClientDraft): Client {
  const client: Client = { id: crypto.randomUUID(), ...draft }
  clients.value = [client, ...clients.value]
  return client
}

export function updateClient(id: string, draft: ClientDraft): Client | null {
  const current = findClient(id)
  if (!current) return null
  const next: Client = { id, ...draft }
  clients.value = clients.value.map((client) => (client.id === id ? next : client))
  return next
}

export function removeClient(id: string): void {
  clients.value = clients.value.filter((client) => client.id !== id)
}