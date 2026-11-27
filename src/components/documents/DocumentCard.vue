<script setup lang="ts">
import IconClock from '~icons/lucide/clock'
import IconMore from '~icons/lucide/ellipsis-vertical'
import IconFile from '~icons/lucide/file-down'
import IconLink from '~icons/lucide/link'
import { onClickOutside, useClipboard, useObjectUrl, useTimeoutFn } from '@vueuse/core'
import { onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'

import { documentsApi, type DocumentListItem } from '@/api'
import { boardColumn, canSend, canVoid, formatAgo, initialOf, isDraft } from '@/domain/documents'
import { formatBytes } from '@/domain/format'

const props = defineProps<{ item: DocumentListItem; index: number; label: string }>()
const emit = defineEmits<{
  download: [item: DocumentListItem]
  print: [item: DocumentListItem]
  void: [item: DocumentListItem]
}>()

// The preview is fetched with the API key: an <img src> cannot send headers.
const blob = shallowRef<Blob | null>(null)
const url = useObjectUrl(blob)
onMounted(async () => {
  try {
    blob.value = await documentsApi.content(props.item.id, { type: 'image' })
  } catch {}
})

const TONES: Record<string, string> = {
  Draft: 'bg-dark-600',
  Ready: 'bg-success-600',
  Sent: 'bg-info-600',
  'Partially Signed': 'bg-warning-600',
  Signed: 'bg-success-600',
  Void: 'bg-alert-600',
}
const tone = () => TONES[boardColumn(props.item.status)] ?? 'bg-dark-600'
const pill = () => {
  const column = boardColumn(props.item.status)
  return column === 'Partially Signed' ? 'Partial' : column
}

const menu = useTemplateRef<HTMLDetailsElement>('menu')
const closeMenu = () => menu.value?.removeAttribute('open')
onClickOutside(menu, closeMenu)

const avatarFailed = ref(false)

const { copy } = useClipboard({ legacy: true })
const shareState = ref<'Share' | 'Link copied' | 'Copy failed'>('Share')
const { start: resetShare } = useTimeoutFn(() => (shareState.value = 'Share'), 2000, {
  immediate: false,
})

/** Share hands out the public view link. Sending for signature lives in the menu. */
async function share() {
  if (!props.item.shareUrl) return
  try {
    await copy(props.item.shareUrl)
    shareState.value = 'Link copied'
  } catch {
    shareState.value = 'Copy failed'
  }
  resetShare()
}

const chip = 'rounded-sm bg-dark-400 px-1.5 py-0.5 text-xs font-semi-bold text-white'
const menuItem = 'rounded-[6px] px-2.5 py-2 text-left enabled:hover:bg-dark-600 disabled:opacity-40'
</script>

<template>
  <article
    class="relative flex shrink-0 flex-col rounded-lg border border-dark-600 bg-dark-500 text-white"
  >
    <RouterLink
      :to="`/documents/${item.id}`"
      class="flex flex-col rounded-t-lg outline-none focus-visible:shadow-focus-ring"
    >
      <div class="relative aspect-[254/199] overflow-hidden rounded-t-lg bg-white">
        <img
          v-if="url"
          :src="url"
          :alt="`Preview of ${item.name}`"
          class="size-full object-cover object-top"
        />
        <span class="absolute top-2 left-2" :class="chip">#{{ index }}</span>
        <span class="absolute bottom-2 left-2" :class="chip">PDF</span>
      </div>
      <div class="flex flex-col gap-2 px-2.5 py-3">
        <div class="flex items-center gap-2">
          <h3 class="min-w-0 flex-1 truncate text-sm font-semi-bold">{{ item.name }}</h3>
          <span class="rounded-full px-2 py-0.5 text-xs font-semi-bold text-white" :class="tone()">
            {{ pill() }}
          </span>
        </div>
        <p class="truncate text-xs text-light-500">{{ label }}</p>
        <p class="flex gap-2 text-xs text-light-500">
          <span v-if="item.updatedAt ?? item.createdAt" class="flex items-center gap-[3px]">
            <IconClock class="size-3" aria-hidden="true" />
            {{ formatAgo(item.updatedAt ?? item.createdAt) }}
          </span>
          <span class="flex items-center gap-[3px]">
            <IconFile class="size-3" aria-hidden="true" />
            {{ formatBytes(item.sizeBytes ?? -1) }}
          </span>
        </p>
      </div>
    </RouterLink>

    <details
      ref="menu"
      class="absolute top-1.5 right-1.5"
      @keydown.esc="closeMenu"
      @click="($event.target as HTMLElement).closest('a, button') && closeMenu()"
    >
      <summary
        class="flex size-6 cursor-pointer list-none items-center justify-center rounded-sm text-dark-400 outline-none hover:bg-dark-400/10 focus-visible:shadow-focus-ring"
        aria-label="More actions"
      >
        <IconMore class="size-4" aria-hidden="true" />
      </summary>
      <div
        class="absolute top-6.5 right-1.5 z-10 flex w-45 flex-col gap-0.5 rounded-[10px] border border-dark-600 bg-overlay p-1.5 text-sm shadow-toolbar"
      >
        <RouterLink
          v-if="isDraft(item.status)"
          :to="`/documents/${item.id}/edit`"
          :class="[menuItem, 'hover:bg-dark-600']"
        >
          Edit document
        </RouterLink>
        <RouterLink :to="`/documents/${item.id}`" :class="[menuItem, 'hover:bg-dark-600']">
          Preview
        </RouterLink>
        <button type="button" :class="menuItem" :disabled="!item.shareUrl" @click="share">
          Copy link
        </button>
        <RouterLink
          v-if="canSend(item.status)"
          :to="`/documents/${item.id}/send`"
          :class="[menuItem, 'hover:bg-dark-600']"
        >
          Send for signature
        </RouterLink>
        <button type="button" :class="menuItem" @click="emit('download', item)">
          Download PDF
        </button>
        <button type="button" :class="menuItem" @click="emit('print', item)">Print PDF</button>
        <button
          type="button"
          :class="menuItem"
          :disabled="!canVoid(item.status)"
          @click="emit('void', item)"
        >
          Void
        </button>
      </div>
    </details>

    <div class="mt-auto flex items-center justify-between gap-2 border-t border-dark-600 px-3 py-2">
      <span
        v-if="item.contact"
        class="flex size-6 items-center justify-center overflow-hidden rounded-full border border-dark-500 bg-overlay text-xs font-semi-bold"
        :title="item.contact.name"
      >
        <img
          v-if="item.contact.avatar && !avatarFailed"
          :src="item.contact.avatar"
          :alt="item.contact.name"
          referrerpolicy="no-referrer"
          class="size-full object-cover"
          @error="avatarFailed = true"
        />
        <template v-else>{{ initialOf(item.contact.name) }}</template>
      </span>
      <span v-else />
      <button
        type="button"
        class="flex h-7 items-center gap-1 rounded-sm bg-accent-500 px-2.5 text-xs font-semi-bold text-white outline-none enabled:hover:bg-accent-600 focus-visible:shadow-focus-ring disabled:opacity-40"
        :disabled="!item.shareUrl"
        :title="item.shareUrl ? 'Copy the public view link' : 'No share link for this document'"
        @click="share"
      >
        <IconLink class="size-3" aria-hidden="true" />
        <span aria-live="polite">{{ shareState }}</span>
      </button>
    </div>
  </article>
</template>