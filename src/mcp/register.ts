import { useWebMCP } from '@vueuse/core'
import { effectScope } from 'vue'

import { createTools, type ToolDeps } from './tools'
import type { MdocToolRegistry, ModelContextTool, ToolResult } from './types'

export function askUser(message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(message))
}

export function registerWebMcp(
  deps: Omit<ToolDeps, 'confirm'> & Partial<Pick<ToolDeps, 'confirm'>>,
) {
  const tools = createTools({ ...deps, confirm: deps.confirm ?? askUser })
  const byName = new Map<string, ModelContextTool>(tools.map((t) => [t.name, t]))

  const registry: MdocToolRegistry = {
    list: () =>
      tools.map(({ name, description, inputSchema, annotations }) => ({
        name,
        description,
        inputSchema,
        annotations,
      })),
    call: async (name, args = {}): Promise<ToolResult> => {
      const found = byName.get(name)
      if (!found) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool "${name}".`, tools: [...byName.keys()] }),
            },
          ],
        }
      }
      return await found.execute(args)
    },
  }
  window.__mdocTools = registry

  const scope = effectScope(true)
  scope.run(() => {
    for (const tool of tools) {
      useWebMCP({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        execute: (args: Record<string, unknown>) => tool.execute(args),
      })
    }
  })

  return registry
}