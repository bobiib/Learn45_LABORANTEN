import { useState, type FormEvent } from 'react'
import { Check, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { AIConfirmationDialog } from '@/components/ui/ai-confirmation-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { LoadingInline } from '@/components/feedback'
import { isDemoMode, learningApi } from '@/lib/api'
import type { ChatMessage, Topic, TopicChangeSet } from '@/lib/types'

const welcome: ChatMessage = { id: 'plan-chat-welcome', role: 'assistant', text: 'Möchtest du deinen Lernpfad oder Lernkontext anpassen? Beschreibe deine Idee. Ich schlage Änderungen vor, die du prüfen kannst, bevor etwas gespeichert wird.' }

function hasChanges(proposal: TopicChangeSet) {
  return Object.keys(proposal.topic).length > 0 || Object.keys(proposal.context).length > 0 || proposal.nodes.length > 0 || proposal.questions.length > 0 || proposal.addNodes.length > 0 || proposal.addQuestions.length > 0 || proposal.deleteNodeIds.length > 0 || proposal.deleteQuestionIds.length > 0
}

function changeLabels(proposal: TopicChangeSet, topic: Topic) {
  const changes: string[] = []
  const labels: Record<string, string> = { title: 'Thementitel', subject: 'Fach', description: 'Themenbeschreibung', examDate: 'Prüfungstermin', timeAvailable: 'Verfügbare Lernzeit', preferredLength: 'Fragenlänge', tutorEnabled: 'KI-Coach', focus: 'Lernschwerpunkt' }
  for (const key of Object.keys(proposal.topic)) changes.push(`${labels[key] ?? key}: ${String(proposal.topic[key as keyof typeof proposal.topic])}`)
  for (const key of Object.keys(proposal.context)) changes.push(`${labels[key] ?? key}: ${String(proposal.context[key as keyof typeof proposal.context])}`)
  for (const change of proposal.nodes) {
    const node = topic.nodes.find((item) => item.id === change.id)
    const details = [change.label ? `Name → ${change.label}` : '', change.description ? `Beschreibung → ${change.description}` : '', change.prerequisites ? `Voraussetzungen → ${change.prerequisites.map((id) => topic.nodes.find((item) => item.id === id)?.label ?? id).join(', ') || 'keine'}` : ''].filter(Boolean)
    changes.push(`Lernschritt „${node?.label ?? 'Lernschritt'}“: ${details.join('; ')}`)
  }
  for (const change of proposal.questions) {
    const question = topic.questions.find((item) => item.id === change.id)
    const details = [change.title ? `Titel → ${change.title}` : '', change.prompt ? `Aufgabe → ${change.prompt}` : '', change.stage ? `Lernstufe → ${change.stage}` : '', change.mode ? `Modus → ${change.mode}` : '', change.durationMinutes ? `Dauer → ${change.durationMinutes} Min.` : ''].filter(Boolean)
    changes.push(`Frage „${question?.title ?? 'Übungsfrage'}“: ${details.join('; ')}`)
  }
  for (const node of proposal.addNodes) changes.push(`Lernschritt „${node.label}“ hinzufügen: ${node.description}`)
  for (const question of proposal.addQuestions) {
    const nodeLabel = topic.nodes.find((node) => node.id === question.nodeRef)?.label ?? proposal.addNodes.find((node) => node.key === question.nodeRef)?.label ?? 'ausgewählter Lernschritt'
    changes.push(`Frage auf Stufe ${question.stage} zu „${nodeLabel}“ hinzufügen: ${question.title} — ${question.prompt}`)
  }
  for (const id of proposal.deleteQuestionIds) {
    const question = topic.questions.find((item) => item.id === id)
    if (question) changes.push(`Frage „${question.title}“ löschen`)
  }
  for (const id of proposal.deleteNodeIds) {
    const node = topic.nodes.find((item) => item.id === id)
    if (node) changes.push(`Lernschritt „${node.label}“ löschen`)
  }
  return changes
}

export function TopicPlanChat({ topic, onTopicUpdated }: { topic: Topic; onTopicUpdated: (topic: Topic) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([welcome])
  const [input, setInput] = useState('')
  const [pendingMessage, setPendingMessage] = useState('')
  const [proposal, setProposal] = useState<TopicChangeSet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendMessage(text: string) {
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setPendingMessage('')
    setBusy(true)
    setError('')
    try {
      const result = await learningApi.proposeTopicChanges(topic.id, nextMessages)
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: result.assistantMessage }])
      setProposal(hasChanges(result.proposal) ? result.proposal : null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Der Lernpartner konnte nicht antworten.')
    } finally {
      setBusy(false)
    }
  }

  async function applyProposal() {
    if (!proposal) return
    setBusy(true)
    setError('')
    try {
      const updated = await learningApi.applyTopicChanges(topic.id, proposal)
      onTopicUpdated(updated)
      setProposal(null)
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'Erledigt. Ich habe die bestätigten Änderungen übernommen.' }])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die bestätigten Änderungen konnten nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const rows = proposal ? changeLabels(proposal, topic) : []

  return <Card className="panel min-w-0 gap-3 p-3 sm:p-4">
    <div className="flex items-center gap-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Sparkles className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0"><p className="eyebrow">KI-LERNPARTNER</p><h2 className="mt-0.5 text-base font-semibold">Lernpfad besprechen</h2></div>
    </div>
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-background p-2" aria-live="polite" aria-label="Gespräch mit dem Lernpartner">
      {messages.map((message) => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><p className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-5 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>{message.text}</p></div>)}
      {busy && <LoadingInline label={proposal ? 'Bestätigte Änderungen werden gespeichert…' : 'Vorschlag wird vorbereitet…'} />}
    </div>
    {proposal && <div className={`rounded-xl border p-3 ${proposal.proposalType === 'alternative' ? 'border-primary/40 bg-accent/40' : 'border-border bg-muted/40'}`} aria-label={proposal.proposalType === 'alternative' ? 'Optionale Alternative' : 'Änderungsvorschlag'}>
      <div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="size-4 text-primary" aria-hidden="true" /> {proposal.proposalType === 'alternative' ? 'Optionale Alternative' : 'Änderungsvorschlag'}</div>
      {proposal.proposalType === 'alternative' && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Das ist Leas Alternative zu deinem Wunsch. Sie wird nur übernommen, wenn du sie auswählst.</p>}
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-foreground">{rows.map((row, index) => <li key={`${index}-${row}`}>{row}</li>)}</ul>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{proposal.proposalType === 'alternative' ? 'Ohne deine Auswahl ändert sich nichts.' : 'Prüfe die Änderungen. Gespeichert werden sie erst nach deiner Bestätigung.'} Fragen mit Übungsverlauf und Lernschritte mit Fortschritt sind vor dem Löschen geschützt.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" size="sm" disabled={busy} onClick={() => void applyProposal()}><Check className="size-3.5" aria-hidden="true" /> {proposal.proposalType === 'alternative' ? 'Alternative übernehmen' : 'Änderungen bestätigen'}</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => setProposal(null)}><X className="size-3.5" aria-hidden="true" /> {proposal.proposalType === 'alternative' ? 'Alternative verwerfen' : 'Verwerfen'}</Button></div>
    </div>}
    {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const text = input.trim(); if (!text || busy || proposal) return; if (isDemoMode) void sendMessage(text); else setPendingMessage(text) }} className="grid gap-2">
      <Textarea id="plan-chat-input" value={input} onChange={(event) => setInput(event.target.value)} rows={2} disabled={busy || Boolean(proposal)} className="min-h-16 resize-y rounded-xl text-sm" aria-label="Nachricht an den Lernpartner" placeholder="Lernschritt oder Frage ergänzen, ändern oder entfernen…" />
      <div className="flex items-center justify-between gap-2"><p className="text-[10px] leading-4 text-muted-foreground">Vorschläge werden geprüft, bevor sie gespeichert werden.{!isDemoMode && ' Nachrichten werden an Gemini gesendet und nicht im Chatverlauf gespeichert.'}</p><Button variant="primary" type="submit" size="icon" aria-label="Nachricht senden" disabled={busy || Boolean(proposal) || !input.trim()}><Send className="size-4" aria-hidden="true" /></Button></div>
    </form>
    {!isDemoMode && <AIConfirmationDialog open={Boolean(pendingMessage)} title="Nachricht an den Lernpartner senden?" description="Gemini prüft dieses Thema und das Gespräch, um Änderungen vorzuschlagen." details="Der aktuelle Lernpfad, Lernkontext, relevante Lernnotizen und der jüngste Chat werden gesendet. Änderungen werden erst übernommen, nachdem du den Vorschlag geprüft und bestätigt hast." onCancel={() => setPendingMessage('')} onConfirm={() => void sendMessage(pendingMessage)} />}
  </Card>
}
