import { useEffect, useMemo, useState } from 'react'
import { Background, Controls, MarkerType, Position, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { ArrowDown, CheckCircle2, LockKeyhole, MousePointerClick } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import type { Topic, TopicNode } from '@/lib/types'

function computeGraphPositions(topicNodes: TopicNode[], narrow: boolean): Record<string, { x: number; y: number }> {
  const depthMap = new Map<string, number>()
  const nodeById = new Map(topicNodes.map((n) => [n.id, n]))

  function getDepth(nodeId: string, visited = new Set<string>()): number {
    if (depthMap.has(nodeId)) return depthMap.get(nodeId)!
    if (visited.has(nodeId)) return 0
    visited.add(nodeId)
    const node = nodeById.get(nodeId)
    if (!node || node.prerequisites.length === 0) {
      depthMap.set(nodeId, 0)
      return 0
    }
    const maxParent = Math.max(0, ...node.prerequisites.map((prereq) => getDepth(prereq, new Set(visited))))
    const depth = maxParent + 1
    depthMap.set(nodeId, depth)
    return depth
  }

  topicNodes.forEach((node) => getDepth(node.id))

  const columns = new Map<number, TopicNode[]>()
  topicNodes.forEach((node) => {
    const d = depthMap.get(node.id) ?? 0
    const list = columns.get(d) ?? []
    list.push(node)
    columns.set(d, list)
  })

  const maxRows = Math.max(1, ...Array.from(columns.values()).map((col) => col.length))
  const positions: Record<string, { x: number; y: number }> = {}

  if (narrow) {
    columns.forEach((colNodes, depth) => {
      const totalWidth = (colNodes.length - 1) * 204
      const startX = 90 - totalWidth / 2
      colNodes.forEach((node, idx) => {
        positions[node.id] = {
          x: startX + idx * 204,
          y: depth * 176,
        }
      })
    })
  } else {
    const rowSpacing = 172
    const totalSpan = (maxRows - 1) * rowSpacing
    columns.forEach((colNodes, depth) => {
      const colSpan = (colNodes.length - 1) * rowSpacing
      const startY = 36 + (totalSpan - colSpan) / 2
      colNodes.forEach((node, idx) => {
        positions[node.id] = {
          x: 24 + depth * 262,
          y: startY + idx * rowSpacing,
        }
      })
    })
  }

  return positions
}

export default function LearningGraph({
  topic,
  selectedNode,
  recommendedNodeId,
  onSelect,
}: {
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

  const positionLookup = useMemo(
    () => computeGraphPositions(topic.nodes, narrow),
    [topic.nodes, narrow],
  )

  const nodes: Node[] = topic.nodes.map((item) => {
    const position = positionLookup[item.id] ?? { x: 80, y: 80 }
    const selected = selectedNode === item.id
    const isRecommended = recommendedNodeId === item.id && item.eligible
    const status = item.progress > 0 ? 'In Arbeit' : item.eligible ? 'Bereit' : 'Gesperrt'
    const questionCount = topic.questions.filter((q) => q.topicId === item.id).length

    return {
      id: item.id,
      position,
      data: {
        label: (
          <div className={`flow-node-content ${item.eligible ? 'is-eligible' : 'is-locked'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flow-node-status">
                {item.eligible ? <CheckCircle2 className="size-3.5 text-foreground" /> : <LockKeyhole className="size-3.5" />}
                {status}
              </span>
              {isRecommended && (
                <span className="inline-flex items-center rounded-md bg-primary/55 px-2 py-0.5 text-[10.5px] font-semibold text-primary-foreground">
                  Hier starten
                </span>
              )}
            </div>
            <span className="flow-node-title">{item.label}</span>
            <span className="flow-node-progress">
              <span className="flow-node-progress-label">
                <span>Fortschritt</span>
                <span className="font-semibold text-foreground">{item.progress}%</span>
              </span>
              <span
                className="flow-node-progress-track"
                role="progressbar"
                aria-label={`Fortschritt: ${item.label}`}
                aria-valuenow={item.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${item.progress}%` }} />
              </span>
            </span>
            <span className={`flow-node-cta ${selected ? 'is-selected' : ''}`}>
              <span>
                {selected
                  ? 'Ausgewählt · Fragen unten'
                  : questionCount > 0
                    ? `${questionCount} ${questionCount === 1 ? 'Frage' : 'Fragen'} öffnen`
                    : 'Abschnitt ansehen'}
              </span>
              <ArrowDown className="flow-node-cta-icon size-3.5" aria-hidden="true" />
            </span>
          </div>
        ),
      },
      style: {
        width: narrow ? 196 : 230,
        minHeight: 146,
        borderRadius: 14,
        borderColor: selected ? 'var(--primary)' : 'var(--border)',
        background: selected ? 'var(--accent)' : 'var(--card)',
        color: 'var(--foreground)',
        boxShadow: selected
          ? '0 0 0 2px var(--primary), 0 4px 12px rgba(15, 23, 42, 0.05)'
          : '0 1px 3px rgba(15, 23, 42, 0.04)',
        opacity: item.eligible ? 1 : 0.78,
        padding: 15,
      },
      sourcePosition: narrow ? Position.Bottom : Position.Right,
      targetPosition: narrow ? Position.Top : Position.Left,
    }
  })

  const edges: Edge[] = topic.nodes.flatMap((node) =>
    node.prerequisites.map((prerequisite) => ({
      id: `edge-${prerequisite}-${node.id}`,
      source: prerequisite,
      target: node.id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
      style: { stroke: '#94A3B8', strokeWidth: 1.75, opacity: 0.85 },
    })),
  )

  const signature = useMemo(() => topic.nodes.map((n) => n.id).join('|'), [topic.nodes])

  return (
    <div
      className={`flow-shell relative ${narrow ? 'h-[610px]' : 'h-[385px] sm:h-[415px]'} overflow-hidden rounded-xl border border-border bg-background`}
      aria-label="Interaktiver Lernpfad"
    >
      <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs">
        <MousePointerClick className="size-3.5 text-foreground" aria-hidden="true" />
        <span>Wähle einen Abschnitt, um die Fragen zu sehen</span>
      </div>
      <ReactFlow
        key={`${narrow ? 'compact' : 'wide'}-${signature}`}
        ariaLabelConfig={{
          'controls.ariaLabel': 'Lernpfad-Steuerung',
          'controls.zoomIn.ariaLabel': 'Vergrößern',
          'controls.zoomOut.ariaLabel': 'Verkleinern',
          'controls.fitView.ariaLabel': 'Ansicht anpassen',
        }}
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.11 }}
        minZoom={0.4}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={(_, node) => onSelect(node.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border)" gap={20} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  )
}
