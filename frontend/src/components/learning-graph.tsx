import { useEffect, useState } from 'react'
import { Background, Controls, MarkerType, Position, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { CheckCircle2, LockKeyhole } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import { nodePositions } from '@/lib/fixtures'
import type { Topic } from '@/lib/types'

export default function LearningGraph({ topic, selectedNode, onSelect }: { topic: Topic; selectedNode: string | null; onSelect: (id: string | null) => void }) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const compactPositions = [
    { id: 'prompt-goal', position: { x: 0, y: 0 } },
    { id: 'prompt-context', position: { x: 180, y: 0 } },
    { id: 'prompt-criteria', position: { x: 90, y: 145 } },
    { id: 'prompt-revise', position: { x: 90, y: 290 } },
    { id: 'prompt-transfer', position: { x: 90, y: 435 } },
  ]
  const positions = narrow ? compactPositions : nodePositions
  const nodes: Node[] = topic.nodes.map((item) => {
    const position = positions.find((point) => point.id === item.id)?.position ?? { x: 80, y: 80 }
    const selected = selectedNode === item.id
    const status = item.progress > 0 ? 'In progress' : item.eligible ? 'Ready' : 'Waiting'
    return {
      id: item.id,
      position,
      data: { label: <div className="flow-node-content"><span className="flow-node-status">{item.eligible ? <CheckCircle2 className="size-3" /> : <LockKeyhole className="size-3" />} {status}</span><span className="flow-node-title">{item.label}</span><span className="flow-node-progress"><span className="flow-node-progress-label">Progress <span>{item.progress}%</span></span><span className="flow-node-progress-track" role="progressbar" aria-label={`${item.label} progress`} aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${item.progress}%` }} /></span></span></div> },
      style: {
        width: narrow ? 166 : 194,
        minHeight: 124,
        borderRadius: 18,
        borderColor: selected ? 'var(--primary)' : 'var(--border)',
        background: selected ? 'var(--accent)' : 'var(--card)',
        color: 'var(--foreground)',
        boxShadow: selected ? '0 0 0 3px color-mix(in oklab, var(--primary) 14%, transparent)' : '0 5px 20px color-mix(in oklab, var(--foreground) 6%, transparent)',
        opacity: item.eligible ? 1 : .68,
        padding: 14,
      },
      sourcePosition: narrow ? Position.Bottom : Position.Right,
      targetPosition: narrow ? Position.Top : Position.Left,
    }
  })
  const edges: Edge[] = topic.nodes.flatMap((node) => node.prerequisites.map((prerequisite) => ({ id: `edge-${prerequisite}-${node.id}`, source: prerequisite, target: node.id, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' }, style: { stroke: 'var(--primary)', strokeWidth: 2, opacity: .72 } })))
  return <div className={`flow-shell ${narrow ? 'h-[580px]' : 'h-[320px] sm:h-[350px]'} overflow-hidden rounded-2xl border border-border bg-background`} aria-label="Interactive learning plan graph">
    <ReactFlow key={narrow ? 'compact' : 'wide'} nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: .12 }} minZoom={.4} nodesConnectable={false} nodesDraggable={false} onNodeClick={(_, node) => onSelect(selectedNode === node.id ? null : node.id)} proOptions={{ hideAttribution: true }}><Background color="var(--border)" gap={20} size={1} /><Controls showInteractive={false} position="bottom-right" /></ReactFlow>
  </div>
}
