import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { nextTick } from 'vue'

import { addClient, clients, findClient, removeClient, updateClient } from '../useClients'

const draft = { name: 'Chai Theory', email: 'a@b.in', phone: '', address: '' }

beforeEach(() => {
  localStorage.clear()
  clients.value = []
})

describe('useClients', () => {
  it('adds, finds, updates and removes clients', () => {
    const created = addClient(draft)
    expect(findClient(created.id)?.name).toBe('Chai Theory')

    updateClient(created.id, { ...draft, name: 'Chai Theory Studios' })
    expect(findClient(created.id)?.name).toBe('Chai Theory Studios')

    removeClient(created.id)
    expect(findClient(created.id)).toBeNull()
    expect(findClient(null)).toBeNull()
  })

  it('puts the newest client first and persists the list', async () => {
    addClient(draft)
    const second = addClient({ ...draft, name: 'Lotus' })
    await nextTick()

    expect(clients.value[0]?.id).toBe(second.id)
    expect(JSON.parse(localStorage.getItem('mdoc.clients') ?? '[]')).toHaveLength(2)
  })

  it('ignores an update for an unknown client', () => {
    expect(updateClient('missing', draft)).toBeNull()
  })
})