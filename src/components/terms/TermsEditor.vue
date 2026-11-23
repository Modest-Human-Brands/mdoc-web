<script setup lang="ts">
import { Extension, EditorContent, useEditor, type Editor } from '@tiptap/vue-3'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { computed, nextTick, ref, watch } from 'vue'

import {
  filterSlash,
  isValidVariable,
  MAX_HEADING,
  sanitizeTermDoc,
  VARIABLE_SUGGESTIONS,
  variableToken,
  type SlashItem,
} from '@/domain/termsEditor'

const props = defineProps<{ modelValue?: unknown; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

interface SlashState {
  from: number
  to: number
  query: string
  left: number
  top: number
}

const slash = ref<SlashState | null>(null)
const slashIndex = ref(0)
const slashItems = computed(() => (slash.value ? filterSlash(slash.value.query) : []))
const container = ref<HTMLElement | null>(null)

/** One nested level of list is allowed: Tab does nothing deeper than that. */
const NestingLimit = Extension.create({
  name: 'nestingLimit',
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { $from } = this.editor.state.selection
        let lists = 0
        for (let depth = $from.depth; depth > 0; depth--) {
          const name = $from.node(depth).type.name
          if (name === 'bulletList' || name === 'orderedList') lists++
        }
        if (lists === 0) return true
        return lists >= 2 ? true : this.editor.commands.sinkListItem('listItem')
      },
    }
  },
})

function refreshSlash(editor: Editor) {
  const { selection } = editor.state
  const { $from, empty } = selection
  if (!empty || $from.parent.type.name !== 'paragraph') {
    slash.value = null
    return
  }
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
  const match = /^\/([A-Za-z0-9 ]{0,20})$/.exec(before)
  if (!match) {
    slash.value = null
    return
  }
  const rect = container.value?.getBoundingClientRect()
  const caret = editor.view.coordsAtPos($from.pos)
  slash.value = {
    from: $from.pos - before.length,
    to: $from.pos,
    query: match[1] ?? '',
    left: caret.left - (rect?.left ?? 0),
    top: caret.bottom - (rect?.top ?? 0) + 4,
  }
  slashIndex.value = 0
}

const editor = useEditor({
  content: sanitizeTermDoc(props.modelValue),
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: false,
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({ placeholder: 'Write the term. Type / for headings and lists.' }),
    NestingLimit,
  ],
  editorProps: {
    handleKeyDown: (_view, event) => {
      if (!slash.value || slashItems.value.length === 0) return false
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1
        const count = slashItems.value.length
        slashIndex.value = (slashIndex.value + step + count) % count
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = slashItems.value[slashIndex.value]
        if (item) pick(item)
        return true
      }
      if (event.key === 'Escape') {
        slash.value = null
        return true
      }
      return false
    },
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getJSON())
    refreshSlash(editor)
  },
  onSelectionUpdate: ({ editor }) => refreshSlash(editor),
})

function pick(item: SlashItem) {
  const current = editor.value
  const state = slash.value
  if (!current || !state) return
  const chain = current.chain().focus().deleteRange({ from: state.from, to: state.to })
  if (item.id === 'paragraph') chain.setParagraph()
  else if (item.id === 'bullet-list') chain.toggleBulletList()
  else if (item.id === 'ordered-list') chain.toggleOrderedList()
  else {
    const level = Math.min(Number(item.id.split('-')[1]), MAX_HEADING) as 1 | 2 | 3
    chain.setHeading({ level })
  }
  chain.run()
  slash.value = null
}

watch(
  () => props.modelValue,
  (value) => {
    const current = editor.value
    if (!current) return
    const next = sanitizeTermDoc(value)
    if (JSON.stringify(current.getJSON()) !== JSON.stringify(next)) {
      current.commands.setContent(next, { emitUpdate: false })
    }
  },
)
watch(
  () => props.disabled,
  (disabled) => editor.value?.setEditable(!disabled),
)

const variableOpen = ref(false)
const variableName = ref('')
const variableInput = ref<HTMLInputElement | null>(null)
const variableValid = computed(() => isValidVariable(variableName.value))

async function openVariable() {
  variableOpen.value = !variableOpen.value
  variableName.value = ''
  if (variableOpen.value) {
    await nextTick()
    variableInput.value?.focus()
  }
}

function insertVariable(name = variableName.value) {
  if (!isValidVariable(name)) return
  editor.value?.chain().focus().insertContent(variableToken(name)).run()
  variableOpen.value = false
  variableName.value = ''
}

interface Tool {
  label: string
  active: string
  text: string
  style: string
  run: (editor: Editor) => void
}

const tools: Tool[] = [
  {
    label: 'Bold',
    active: 'bold',
    text: 'B',
    style: 'font-bold',
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: 'Italic',
    active: 'italic',
    text: 'I',
    style: 'italic',
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: 'Heading',
    active: 'heading',
    text: 'H',
    style: 'font-bold',
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Bullet list',
    active: 'bulletList',
    text: '•',
    style: '',
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    active: 'orderedList',
    text: '1.',
    style: '',
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
]
</script>

<template>
  <div ref="container" class="terms-editor relative flex flex-col gap-2">
    <div
      class="flex flex-wrap items-center gap-0.5 text-light-400 opacity-70 transition-opacity focus-within:opacity-100 hover:opacity-100"
      role="toolbar"
      aria-label="Formatting"
    >
      <button
        v-for="tool in tools"
        :key="tool.label"
        type="button"
        class="size-8 rounded-sm text-sm text-light-500 outline-none hover:bg-dark-500 hover:text-white focus-visible:shadow-focus-ring disabled:opacity-40"
        :class="[tool.style, editor?.isActive(tool.active) ? 'bg-dark-600 text-white' : '']"
        :aria-label="tool.label"
        :aria-pressed="editor?.isActive(tool.active) ?? false"
        :disabled="disabled || !editor"
        @click="editor && tool.run(editor)"
      >
        {{ tool.text }}
      </button>
      <span class="mx-1 h-5 w-px bg-dark-600" aria-hidden="true" />
      <button
        type="button"
        class="rounded-sm px-2 py-1 text-xs font-semi-bold text-light-500 outline-none hover:bg-dark-500 hover:text-white focus-visible:shadow-focus-ring disabled:opacity-40"
        :aria-expanded="variableOpen"
        :disabled="disabled || !editor"
        @click="openVariable"
      >
        Insert variable
      </button>
    </div>

    <form
      v-if="variableOpen"
      class="flex flex-col gap-2 rounded-md border border-dark-600 bg-dark-500 p-3"
      @submit.prevent="insertVariable()"
    >
      <label class="text-xs text-light-500" for="term-variable">
        Variable name, filled in when the document is created. Unknown names stay as text.
      </label>
      <div class="flex gap-2">
        <input
          id="term-variable"
          ref="variableInput"
          v-model="variableName"
          class="h-8 min-w-0 flex-1 rounded-sm border border-dark-600 bg-dark-400 px-2 text-sm text-white outline-none focus:border-accent-400"
          placeholder="recipient.name"
          autocomplete="off"
        />
        <button
          type="submit"
          class="rounded-sm bg-accent-500 px-3 text-xs font-semi-bold text-white disabled:opacity-40"
          :disabled="!variableValid"
        >
          Insert
        </button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="name in VARIABLE_SUGGESTIONS"
          :key="name"
          type="button"
          class="rounded-full border border-dark-600 px-2 py-0.5 text-xs text-light-500 hover:text-white"
          @click="insertVariable(name)"
        >
          {{ variableToken(name) }}
        </button>
      </div>
    </form>

    <EditorContent
      :editor="editor"
      class="min-h-64 cursor-text pb-32"
      @click.self="editor?.commands.focus('end')"
    />

    <ul
      v-if="slash && slashItems.length > 0"
      class="absolute z-10 flex w-56 flex-col rounded-md border border-dark-600 bg-dark-500 p-1 shadow-lg"
      role="listbox"
      aria-label="Insert"
      :style="{ left: `${slash.left}px`, top: `${slash.top}px` }"
    >
      <li
        v-for="(item, index) in slashItems"
        :key="item.id"
        role="option"
        :aria-selected="index === slashIndex"
        class="flex cursor-pointer flex-col rounded-sm px-2 py-1.5"
        :class="index === slashIndex ? 'bg-dark-600' : ''"
        @mousedown.prevent="pick(item)"
        @mouseenter="slashIndex = index"
      >
        <span class="text-sm text-white">{{ item.label }}</span>
        <span class="text-xs text-light-400">{{ item.hint }}</span>
      </li>
    </ul>
  </div>
</template>

<style>
.terms-editor .tiptap {
  min-height: 16rem;
  padding: 0;
  cursor: text;
  outline: none;
  color: var(--color-light-700);
  font-size: 1rem;
  line-height: 1.7;
  caret-color: #fff;
}
.terms-editor .tiptap > * + * {
  margin-top: 0.25rem;
}
.terms-editor .tiptap p {
  margin: 0;
  padding: 0.15rem 0;
}
.terms-editor .tiptap ul {
  margin: 0;
  padding-left: 1.5rem;
  list-style: disc;
}
.terms-editor .tiptap ol {
  margin: 0;
  padding-left: 1.5rem;
  list-style: decimal;
}
.terms-editor .tiptap li > p {
  padding: 0.1rem 0;
}
.terms-editor .tiptap ul ul {
  list-style: circle;
}
.terms-editor .tiptap h1,
.terms-editor .tiptap h2,
.terms-editor .tiptap h3 {
  margin: 1.25rem 0 0.25rem;
  color: #fff;
  font-weight: 600;
  line-height: 1.25;
}
.terms-editor .tiptap h1 {
  font-size: 1.875rem;
}
.terms-editor .tiptap h2 {
  font-size: 1.5rem;
}
.terms-editor .tiptap h3 {
  font-size: 1.25rem;
}
.terms-editor .tiptap strong {
  color: #fff;
}
.terms-editor .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--color-light-400);
  opacity: 0.6;
  pointer-events: none;
}
</style>