import { useTimeoutFn } from '@vueuse/core'
import { shallowRef } from 'vue'

import type { TemplatePage } from '@/api'

export interface StageSource {
  url: string | null
  pages: TemplatePage[] | null
}

const REVOKE_DELAY_MS = 1000

export const lastShown = shallowRef<StageSource | null>(null)

export function isHeld(url: string): boolean {
  return lastShown.value?.url === url
}

export function showStage(source: StageSource) {
  const previous = lastShown.value?.url
  lastShown.value = source
  if (previous && previous !== source.url && previous.startsWith('blob:')) {
    useTimeoutFn(() => URL.revokeObjectURL(previous), REVOKE_DELAY_MS)
  }
}