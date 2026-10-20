import { computed, ref, watch, type Ref } from 'vue'

import { documentsApi, type DocumentListItem } from '@/api'
import { PAGE_SIZE, type StatusFilter } from '@/domain/documents'

import { errorMessage } from './useTemplates'

export function useDocumentList(status: Ref<StatusFilter>, page: Ref<number>) {
  const items = ref<DocumentListItem[]>([])
  const total = ref(0)
  const loading = ref(true)
  const error = ref<string | null>(null)
  let ticket = 0

  async function load() {
    const mine = ++ticket
    loading.value = true
    error.value = null
    try {
      const response = await documentsApi.list({
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE,
        status: status.value === 'All' ? undefined : status.value,
      })
      if (mine !== ticket) return
      items.value = response.results
      total.value = response.pagination.total
    } catch (e) {
      if (mine === ticket) error.value = errorMessage(e)
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  watch([status, page], load, { immediate: true })

  const offset = computed(() => (page.value - 1) * PAGE_SIZE)
  const hasNext = computed(() => offset.value + items.value.length < total.value)

  return { items, total, loading, error, offset, hasNext, reload: load }
}