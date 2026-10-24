import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, CheckCircle2, LockKeyhole, MousePointerClick } from 'lucide-react'
import { Background, Controls, MarkerType, Position, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Topic, TopicNode } from '@/lib/types'

const nodeWidth = 230
const nodeHeight = 146
const layerGap = 44
const rowGap = 26

function computeLevels(topicNodes: TopicNode[]) {
  const byId = new Map(topicNodes.map((node) => [node.id, node]))
  const levels = new Map<string, number>()
  function depth(id: string, visiting = new Set<string>()): number {
    const cached = levels.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0
    const node = byId.get(id)
    if (!node) return 0
    const nextVisiting = new Set(visiting).add(id)
    const parents = node.prerequisites.map((parent) => depth(parent, nextVisiting))
    const value = parents.length ? Math.max(...parents) + 1 : 0
    levels.set(id, value)
    return value
  }
  topicNodes.forEach((node) => depth(node.id))
  return levels
}

export default function LearningGraph({ topic, selectedNode, recommendedNodeId, onSelect }: {
  topic: Topic
  selectedNode: string | null
  recommendedNodeId?: string | null
  onSelect: (id: string | null) => void
}) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const levels = useMemo(() => computeLevels(topic.nodes), [topic.nodes])
  const grouped = useMemo(() => {
    const result = new Map<number, TopicNode[]>()
    for (const item of topic.nodes) {
      const level = levels.get(item.id) ?? 0
      result.set(level, [...(result.get(level) ?? []), item])
    }
    return result
  }, [levels, topic.nodes])
  const layerKeys = useMemo(() => [...grouped.keys()].sort((a, b) => a - b), [grouped])
  const maxLayerSize = Math.max(1, ...[...grouped.values()].map((items) => items.length))
  const graphHeight = narrow
    ? Math.max(610, 48 + topic.nodes.length * (nodeHeight + rowGap))
    : Math.max(385, 48 + maxLayerSize * (nodeHeight + rowGap))
  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>()
    if (narrow) {
      topic.nodes.forEach((item, index) => result.set(item.id, { x: 24, y: 32 + index * (nodeHeight + rowGap) }))
    } else {
      layerKeys.forEach((level, column) => {
        const items = grouped.get(level) ?? []
        const columnHeight = items.length * nodeHeight + Math.max(0, items.length - 1) * rowGap
        items.forEach((item, index) => result.set(item.id, {
          x: 32 + column * (nodeWidth + layerGap),
          y: (graphHeight - columnHeight) / 2 + index * (nodeHeight + rowGap),
        }))
      })
    }
    return result
  }, [graphHeight, grouped, layerKeys, narrow, topic.nodes])

  const nodes: Node[] = topic.nodes.map((item) => {
    const selected = selectedNode === item.id
    const recommended = recommendedNodeId === item.id && item.eligible
    const status = item.progress > 0 ? 'In Arbeit' : item.eligible ? 'Bereit' : 'Gesperrt'
    const count = topic.questions.filter((question) => question.topicId === item.id).length
    return {
      id: item.id,
      position: positions.get(item.id) ?? { x: 32, y: 32 },
      data: { label: (
        <div className={`flow-node-content ${item.eligible ? 'is-eligible' : 'is-locked'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flow-node-status">{item.eligible ? <CheckCircle2 className="size-3.5 text-foreground" /> : <LockKeyhole className="size-3.5" />}{status}</span>
            {recommended && <span className="inline-flex items-center rounded-md bg-primary/55 px-2 py-0.5 text-[10.5px] font-semibold text-primary-foreground">Hier starten</span>}
          </div>
          <span className="flow-node-title">{item.label}</span>
          <span className="flow-node-progress">
            <span className="flow-node-progress-label"><span>Fortschritt</span><span className="font-semibold text-foreground">{item.progress}%</span></span>
            <span className="flow-node-progress-track" role="progressbar" aria-label={`Fortschritt: ${item.label}`} aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${item.progress}%` }} /></span>
          </span>
          <span className={`flow-node-cta ${selected ? 'is-selected' : ''}`}><span>{selected ? 'Ausgewählt · Fragen unten' : count ? `${count} ${count === 1 ? 'Frage' : 'Fragen'} öffnen` : 'Abschnitt ansehen'}</span><ArrowDown className="flow-node-cta-icon size-3.5" aria-hidden="true" /></span>
        </div>
      ) },
      style: {
        width: narrow ? 196 : nodeWidth,
        minHeight: nodeHeight,
        borderRadius: 14,
        borderColor: selected ? 'var(--primary)' : 'var(--border)',
        background: selected ? 'var(--accent)' : 'var(--card)',
        color: 'var(--foreground)',
        boxShadow: selected ? '0 0 0 2px var(--primary), 0 4px 12px color-mix(in oklab, var(--foreground) 5%, transparent)' : '0 1px 3px color-mix(in oklab, var(--foreground) 5%, transparent)',
        opacity: item.eligible ? 1 : 0.78,
        padding: 15,
      },
      sourcePosition: narrow ? Position.Bottom : Position.Right,
      targetPosition: narrow ? Position.Top : Position.Left,
    }
  })
  const edges: Edge[] = topic.nodes.flatMap((node) => node.prerequisites.map((prerequisite) => ({
    id: `edge-${prerequisite}-${node.id}`,
    source: prerequisite,
    target: node.id,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
    style: { stroke: 'var(--primary)', strokeWidth: 2, opacity: 0.72 },
  })))
  const signature = topic.nodes.map((node) => node.id).join('|')

  return <div className="flow-shell relative overflow-hidden rounded-xl border border-border bg-background" style={{ height: graphHeight }} aria-label="Interaktiver Lernpfad">
    <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs"><MousePointerClick className="size-3.5 text-foreground" aria-hidden="true" /><span>Wähle einen Abschnitt, um die Fragen zu sehen</span></div>
    <ReactFlow key={`${narrow ? 'compact' : 'wide'}-${topic.id}-${signature}`} ariaLabelConfig={{ 'controls.ariaLabel': 'Lernpfad-Steuerung', 'controls.zoomIn.ariaLabel': 'Vergrößern', 'controls.zoomOut.ariaLabel': 'Verkleinern', 'controls.fitView.ariaLabel': 'Ansicht anpassen' }} nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.11 }} minZoom={0.4} nodesConnectable={false} nodesDraggable={false} onNodeClick={(_, node) => onSelect(node.id)} proOptions={{ hideAttribution: true }}>
      <Background color="var(--border)" gap={20} size={1} /><Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  </div>
}
