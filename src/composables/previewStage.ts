import { shallowRef } from 'vue'

import type { TemplatePage } from '@/api'

import { releaseBlob, retainBlob } from './blobRegistry'

export interface StageSource {
  url: string | null
  pages: TemplatePage[] | null
}

export const lastShown = shallowRef<StageSource | null>(null)

export function showStage(source: StageSource) {
  const previous = lastShown.value?.url
  retainBlob(source.url)
  lastShown.value = source
  releaseBlob(previous)
}