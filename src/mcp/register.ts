import { createTools, type ToolDeps } from './tools'
import type { AgentClient, MdocToolRegistry, ModelContextTool, ToolResult } from './types'

export async function askUser(message: string, client?: AgentClient): Promise<boolean> {
  if (client?.requestUserInteraction) {
    return await client.requestUserInteraction(async () => window.confirm(message))
  }
  return window.confirm(message)
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

  const modelContext = navigator.modelContext
  if (modelContext && typeof modelContext.registerTool === 'function') {
    for (const tool of tools) {
      try {
        modelContext.registerTool(tool)
      } catch (error) {
        console.warn(`WebMCP: could not register "${tool.name}"`, error)
      }
    }
  }

  return registry
}