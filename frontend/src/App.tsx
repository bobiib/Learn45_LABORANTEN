import { useState, type FormEvent } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import '@xyflow/react/dist/style.css'

const initialNodes: Node[] = [
  { id: 'challenge', position: { x: 0, y: 80 }, data: { label: 'Solo · First attempt' }, type: 'input' },
  { id: 'coach', position: { x: 230, y: 0 }, data: { label: 'AI · Clarify criteria' } },
  { id: 'retry', position: { x: 230, y: 160 }, data: { label: 'Solo · Try again' }, type: 'output' },
]
const initialEdges: Edge[] = [
  { id: 'e1', source: 'challenge', target: 'coach', animated: true, label: 'repeated gap' },
  { id: 'e2', source: 'coach', target: 'retry', label: 'practice independently' },
]

export default function App() {
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState('')

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!answer.trim()) return
    setFeedback('What would make this answer verifiable? Add a length, audience, or required detail, then try again.')
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div><p className="eyebrow">LEARN45 · LEARNING AGENT</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">A better next step, at the right moment.</h1></div>
          <span className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">15 min · Lea’s path</span>
        </header>
        <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="panel">
            <div className="flex items-center justify-between"><div><p className="eyebrow">CHALLENGE · SOLO</p><h2 className="mt-2 text-xl font-semibold">Give the AI a clear assignment</h2></div><span className="text-sm text-stone-500">Step 1 of 3</span></div>
            <p className="mt-5 leading-7 text-muted-foreground">Write an instruction that would help an AI summarize project notes for your project lead. Make it clear what a useful summary must include.</p>
            <form onSubmit={submitAnswer} className="mt-5 space-y-3">
              <textarea className="w-full rounded-xl border border-input bg-card p-4 text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Your instruction…" />
              <Button type="submit">Get feedback</Button>
            </form>
            {feedback && <div className="mt-5 rounded-xl bg-warning p-4 text-sm leading-6 text-warning-foreground"><strong>Agent feedback</strong><p className="mt-1">{feedback}</p></div>}
            <div className="mt-7 rounded-xl bg-accent p-4"><p className="eyebrow text-accent-foreground">WHY THIS STEP?</p><p className="mt-2 text-sm leading-6 text-accent-foreground">Two earlier attempts missed concrete quality criteria. A short coaching prompt can help Lea define those criteria before she practises again on her own.</p></div>
          </div>
          <div className="panel min-h-[430px]"><div className="mb-4"><p className="eyebrow">LEARNING JOURNEY</p><h2 className="mt-2 text-xl font-semibold">The agent adapts the route</h2></div><div className="h-[340px] overflow-hidden rounded-xl bg-muted"><ReactFlow nodes={initialNodes} edges={initialEdges} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}><Background /><Controls /></ReactFlow></div></div>
        </section>
        <footer className="mt-6 text-center text-sm text-muted-foreground">Challenge → Action → Feedback → Adaptation → Progress</footer>
      </div>
    </main>
  )
}
