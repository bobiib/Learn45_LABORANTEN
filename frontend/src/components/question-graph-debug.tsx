import { useMemo, useState } from 'react'
import { Background, Controls, MarkerType, Position, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LearningQuestion } from '@/lib/types'
import '@xyflow/react/dist/style.css'

type ReasoningGraph = NonNullable<LearningQuestion['reasoningGraph']>

export default function QuestionGraphDebug({ question }: { question: LearningQuestion }) {
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen((current) => !current)
  const graph = question.reasoningGraph ?? question.content?.reasoningGraph as ReasoningGraph | undefined
  const { nodes, edges, width, height } = useMemo(() => {
    if (!graph?.nodes?.length) return { nodes: [] as Node[], edges: [] as Edge[], width: 360, height: 280 }
    const levels = new Map<string, number>()
    const incoming = new Map(graph.nodes.map((node) => [node.id, graph.edges.filter((edge) => edge.target === node.id).length]))
    const outgoing = new Map(graph.nodes.map((node) => [node.id, graph.edges.filter((edge) => edge.source === node.id)]))
    const ready = graph.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id)
    while (ready.length) {
      const id = ready.shift()!
      for (const edge of outgoing.get(id) ?? []) {
        levels.set(edge.target, Math.max(levels.get(edge.target) ?? 0, (levels.get(id) ?? 0) + 1))
        incoming.set(edge.target, (incoming.get(edge.target) ?? 1) - 1)
        if (incoming.get(edge.target) === 0) ready.push(edge.target)
      }
    }
    const layers = new Map<number, string[]>()
    for (const item of graph.nodes) {
      const level = levels.get(item.id) ?? 0
      layers.set(level, [...(layers.get(level) ?? []), item.id])
    }
    const maxLayerSize = Math.max(1, ...[...layers.values()].map((items) => items.length))
    const canvasWidth = Math.max(360, maxLayerSize * 300 + 72)
    const positions = new Map<string, { x: number; y: number }>()
    for (const [level, items] of layers) {
      const rowWidth = items.length * 272 + (items.length - 1) * 28
      items.forEach((id, index) => positions.set(id, {
        x: (canvasWidth - rowWidth) / 2 + index * 300,
        y: 42 + level * 190,
      }))
    }
    const flowNodes: Node[] = graph.nodes.map((item) => {
      return {
        id: item.id,
        position: positions.get(item.id) ?? { x: 36, y: 42 },
        data: { label: <div className="space-y-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Schritt {graph.nodes.indexOf(item) + 1} · {item.id}</span><p className="whitespace-normal text-sm leading-6 text-foreground">{item.step}</p></div> },
        style: { width: 272, minHeight: 104, border: '1px solid var(--border)', borderRadius: 16, padding: 16, background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 5px 18px color-mix(in oklab, var(--foreground) 6%, transparent)' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }
    })
    const flowEdges: Edge[] = graph.edges.map((edge, index) => ({
      id: `deduction-${index}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: <span className="inline-block max-w-48 whitespace-normal rounded-lg border border-border bg-background px-2 py-1 text-center text-[11px] font-medium leading-4 text-foreground shadow-sm">{edge.deduction}</span>,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
      style: { stroke: 'var(--primary)', strokeWidth: 2 },
      labelStyle: { fill: 'var(--foreground)', fontSize: 12, fontWeight: 600 },
      labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.98 },
      labelBgPadding: [8, 5] as [number, number],
      labelBgBorderRadius: 8,
    }))
    return { nodes: flowNodes, edges: flowEdges, width: canvasWidth, height: Math.max(300, (Math.max(...layers.keys()) + 1) * 190 + 60) }
  }, [graph])

  return <>
    <Button variant="ghost" size="sm" className="fixed right-0 top-1/2 z-50 h-auto -translate-y-1/2 rounded-r-none border border-r-0 border-border bg-card/85 px-2 py-3 text-[10px] text-muted-foreground shadow-sm [writing-mode:vertical-rl] hover:text-foreground" aria-expanded={open} aria-controls="question-graph-debug-panel" onClick={toggle}>
      Diagramm · Debug
    </Button>
    {open && <div id="question-graph-debug-panel" role="region" aria-label="Debugansicht des Lösungswegs" className="fixed inset-y-0 right-0 z-40 flex w-[min(92vw,660px)] flex-col border-l border-border bg-background shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div className="min-w-0"><p className="eyebrow">DEBUGANSICHT</p><h2 className="mt-1 truncate text-base font-semibold">Lösungsweg</h2><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{question.title}</p></div><Button variant="ghost" size="icon-sm" aria-label="Debugansicht schliessen" onClick={toggle}><X aria-hidden="true" /></Button></div>
      {nodes.length ? <div className="min-h-0 flex-1 overflow-auto p-3"><div className="flow-shell relative mx-auto overflow-hidden rounded-2xl border border-border bg-background" style={{ width, height }}><ReactFlow key={`${question.id}-${width}-${height}`} nodes={nodes} edges={edges} minZoom={.55} maxZoom={1.5} defaultViewport={{ x: 0, y: 0, zoom: 1 }} nodesConnectable={false} nodesDraggable={false} proOptions={{ hideAttribution: true }}><Background color="var(--border)" gap={20} size={1} /><Controls showInteractive={false} position="bottom-right" /></ReactFlow></div></div> : <p className="m-5 rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">Zu dieser Frage gibt es noch keinen Lösungsweg. Neu generierte KI-Fragen erhalten ihn, sobald die Planerstellung aktualisiert wurde.</p>}
    </div>}
  </>
}
