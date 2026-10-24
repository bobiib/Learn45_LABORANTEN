import { useMemo, useState } from 'react'
import { Background, MarkerType, Position, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import type { LearningActivity } from '@/lib/learning-types'

export function MentalModel({ graph }: { graph: LearningActivity['reasoningGraph'] }) {
  const [open, setOpen] = useState(false)
  const { nodes, edges, width, height } = useMemo(() => {
    if (!graph?.nodes.length) return { nodes: [] as Node[], edges: [] as Edge[], width: 0, height: 0 }
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
    graph.nodes.forEach((node) => {
      const level = levels.get(node.id) ?? 0
      layers.set(level, [...(layers.get(level) ?? []), node.id])
    })
    const maxLayerSize = Math.max(1, ...[...layers.values()].map((items) => items.length))
    const canvasWidth = Math.max(360, maxLayerSize * 300 + 72)
    const positions = new Map<string, { x: number; y: number }>()
    for (const [level, items] of layers) {
      const rowWidth = items.length * 272 + (items.length - 1) * 28
      items.forEach((id, index) => positions.set(id, { x: (canvasWidth - rowWidth) / 2 + index * 300, y: 28 + level * 175 }))
    }
    const flowNodes: Node[] = graph.nodes.map((item, index) => ({
      id: item.id,
      position: positions.get(item.id) ?? { x: 36, y: 28 },
      data: { label: <div className="space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gedanke {index + 1}</span><p className="whitespace-normal text-sm leading-5 text-foreground">{item.step}</p></div> },
      style: { width: 272, minHeight: 88, border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--card)', color: 'var(--foreground)' },
      sourcePosition: Position.Bottom, targetPosition: Position.Top,
    }))
    const flowEdges: Edge[] = graph.edges.map((edge, index) => ({
      id: `mental-${index}-${edge.source}-${edge.target}`, source: edge.source, target: edge.target,
      label: <span className="inline-block max-w-44 whitespace-normal rounded-lg border border-border bg-background px-2 py-1 text-center text-[11px] leading-4 text-foreground">{edge.deduction}</span>,
      type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
      style: { stroke: 'var(--primary)', strokeWidth: 2 }, labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.98 },
    }))
    return { nodes: flowNodes, edges: flowEdges, width: canvasWidth, height: Math.max(270, (Math.max(...layers.keys()) + 1) * 175 + 28) }
  }, [graph])

  if (!graph?.nodes.length) return null
  return <section className="mt-5 rounded-xl border border-border bg-card/60 p-3 sm:p-4" aria-label="Visualisierung des Gedankengangs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-sm font-semibold">Gedankengang</h2><p className="mt-0.5 text-xs text-muted-foreground">Sieh, wie einzelne Ideen miteinander verbunden sind.</p></div>
      <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Ausblenden' : 'Visualisierung öffnen'}</Button>
    </div>
    {open && <div className="mt-3 overflow-auto rounded-lg border border-border bg-background p-2"><div className="flow-shell relative mx-auto overflow-hidden rounded-lg" style={{ width, height }}><ReactFlow nodes={nodes} edges={edges} fitView minZoom={.45} maxZoom={1.5} nodesConnectable={false} nodesDraggable={false} proOptions={{ hideAttribution: true }}><Background color="var(--border)" gap={20} size={1} /></ReactFlow></div></div>}
  </section>
}
