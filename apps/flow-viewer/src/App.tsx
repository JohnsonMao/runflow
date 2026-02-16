import type { FlowDefinitionInput } from './flowDefinitionToGraph'
import type { FlowGraphEdgeKind, FlowGraphInput } from './types'
import { useCallback, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { FlowCanvas } from './FlowCanvas'
import { ensureNodeShapes, flowDefinitionToGraph } from './flowDefinitionToGraph'

function parseFlowDefinitionJson(text: string): FlowGraphInput | null {
  try {
    const data = JSON.parse(text) as unknown
    if (data === null || typeof data !== 'object' || !('name' in data) || !('steps' in data))
      return null
    const raw = data as { name: string, description?: string, steps: unknown[] }
    if (!Array.isArray(raw.steps))
      return null
    const steps = raw.steps.map((s) => {
      if (s == null || typeof s !== 'object' || !('id' in s) || typeof (s as { id: unknown }).id !== 'string')
        return null
      const o = s as Record<string, unknown>
      return {
        id: o.id as string,
        type: typeof o.type === 'string' ? o.type : undefined,
        dependsOn: Array.isArray(o.dependsOn) ? (o.dependsOn as string[]) : undefined,
        connect: o.connect,
        end: o.end,
        done: o.done,
        then: o.then,
        else: o.else,
      }
    }).filter(Boolean) as FlowDefinitionInput['steps']
    return flowDefinitionToGraph({ name: raw.name, description: raw.description, steps })
  }
  catch {
    return null
  }
}

function parseGraphJson(text: string): FlowGraphInput | null {
  try {
    const data = JSON.parse(text) as unknown
    if (data === null || typeof data !== 'object' || Array.isArray(data))
      return null
    const obj = data as Record<string, unknown>
    const nodes = obj.nodes
    const edges = obj.edges
    if (!Array.isArray(nodes) || !Array.isArray(edges))
      return null
    const nodeList = nodes.map((n: unknown) => {
      if (n === null || typeof n !== 'object')
        return null
      const o = n as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id : ''
      if (!id)
        return null
      const validShapes = ['process', 'decision', 'start', 'end'] as const
      return {
        id,
        type: typeof o.type === 'string' ? o.type : undefined,
        label: typeof o.label === 'string' ? o.label : undefined,
        shape: typeof o.shape === 'string' && validShapes.includes(o.shape as typeof validShapes[number]) ? o.shape as typeof validShapes[number] : undefined,
      }
    }).filter(Boolean) as FlowGraphInput['nodes']
    const validKinds: FlowGraphEdgeKind[] = ['dependsOn', 'loopBack', 'done', 'then', 'else']
    const edgeList = edges.map((e: unknown) => {
      if (e === null || typeof e !== 'object')
        return null
      const o = e as Record<string, unknown>
      const source = typeof o.source === 'string' ? o.source : ''
      const target = typeof o.target === 'string' ? o.target : ''
      if (!source || !target)
        return null
      const kind = typeof o.kind === 'string' && validKinds.includes(o.kind as FlowGraphEdgeKind) ? o.kind as FlowGraphEdgeKind : undefined
      return kind ? { source, target, kind } : { source, target }
    }).filter(Boolean) as FlowGraphInput['edges']
    return { nodes: nodeList, edges: edgeList, flowName: typeof obj.flowName === 'string' ? obj.flowName : undefined, flowDescription: typeof obj.flowDescription === 'string' ? obj.flowDescription : undefined }
  }
  catch {
    return null
  }
}

export function App(): React.ReactElement {
  const [graph, setGraph] = useState<FlowGraphInput | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handlePaste = useCallback(() => {
    setError(null)
    let parsed = parseGraphJson(pasteText)
    if (!parsed && pasteText.trim())
      parsed = parseFlowDefinitionJson(pasteText)
    if (parsed && parsed.nodes.length > 0) {
      setGraph(ensureNodeShapes(parsed))
    }
    else {
      setError('Invalid or empty JSON. Paste graph JSON (`flow view ... --output json`) or FlowDefinition JSON.')
    }
  }, [pasteText])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) {
      setGraph(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      let parsed = parseGraphJson(text)
      if (!parsed && text.trim())
        parsed = parseFlowDefinitionJson(text)
      if (parsed && parsed.nodes.length > 0) {
        setGraph(ensureNodeShapes(parsed))
      }
      else {
        setError('Invalid or empty JSON in file (graph or FlowDefinition).')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-4 py-3">
        <h1 className="m-0 text-lg font-medium">Flow Viewer</h1>
        <label className="flex items-center gap-2">
          <span>Upload graph.json</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="text-sm"
          />
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Paste graph JSON or FlowDefinition JSON"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            className="min-w-[280px] rounded border border-slate-300 px-2.5 py-1.5 text-sm"
            onKeyDown={e => e.key === 'Enter' && handlePaste()}
          />
          <button
            type="button"
            onClick={handlePaste}
            className="rounded border border-slate-400 bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200"
          >
            Load
          </button>
        </div>
        {graph?.flowName && <span className="text-slate-500">{graph.flowName}</span>}
      </header>
      {error && (
        <div className="bg-red-100 px-2 py-2 text-red-700">
          {error}
        </div>
      )}
      <main className="min-h-0 flex-1">
        {graph
          ? (
              <ReactFlowProvider>
                <div className="h-full w-full">
                  <FlowCanvas graph={graph} />
                </div>
              </ReactFlowProvider>
            )
          : (
              <div className="p-6 text-center text-slate-500">
                Upload graph.json or paste graph/FlowDefinition JSON (
                <code className="rounded bg-slate-100 px-1">flow view &lt;flowId&gt; --output json</code>
                )
              </div>
            )}
      </main>
    </div>
  )
}
