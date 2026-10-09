export interface JsonSchemaObject {
  type: 'object'
  properties?: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

export interface ModelContextTool {
  name: string
  description: string
  inputSchema: JsonSchemaObject
  annotations?: { readOnlyHint?: boolean }
  execute: (input: Record<string, unknown>) => Promise<ToolResult>
}

export interface MdocToolRegistry {
  list: () => Pick<ModelContextTool, 'name' | 'description' | 'inputSchema' | 'annotations'>[]
  call: (name: string, args?: Record<string, unknown>) => Promise<ToolResult>
}

declare global {
  interface Window {
    __mdocTools?: MdocToolRegistry
  }
}