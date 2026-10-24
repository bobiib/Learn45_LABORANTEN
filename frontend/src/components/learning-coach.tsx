import { useEffect, useMemo, useRef, useState } from 'react'
import { TextStreamChatTransport, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { ArrowUp, ArrowUpRight, LoaderCircle, MessagesSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LoadingInline } from '@/components/feedback'
import { isDemoMode, learningApi, getApiUrl } from '@/lib/api'
import type { ChatMessage, LearningActivity, LearningMode, ReviewResult, Topic } from '@/lib/learning-types'
import { coachReply } from '@/lib/learning-engine'
import { LearningSurface } from '@/components/ui/learning'
import { theoryFor } from '@/lib/learning-content'

type ChatKind = 'tutor' | 'scope'

type AIChatProps = {
  kind: ChatKind
  chatId: string
  topicId?: string
  questionId?: string
  initialMessages: ChatMessage[]
  title: string
  detail: string
  compact?: boolean
  onMessagesChange?: (messages: ChatMessage[]) => void
  onTopicUpdated?: (topic: Topic) => void
  workspace?: boolean
  active?: boolean
  mode?: LearningMode
  activity?: LearningActivity
  learnerAnswer?: string
  review?: ReviewResult | null
  onActivate?: () => void
  onSupport?: () => void
  disabled?: boolean
  turnContext?: string
}

function toUiMessages(messages: ChatMessage[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.text }],
  }))
}

function toAppMessages(messages: UIMessage[]): ChatMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'user' && message.role !== 'assistant') return []
    const text = message.parts.flatMap((part) => part.type === 'text' ? [part.text] : []).join('')
    return text ? [{ id: message.id, role: message.role, text }] : []
  })
}

function streamResponse(text: string, signal?: AbortSignal) {
  const encoder = new TextEncoder()
  const pieces = text.match(/\S+\s*/g) ?? [text]
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const piece of pieces) {
          if (cancelled || signal?.aborted) break
          controller.enqueue(encoder.encode(piece))
          await new Promise((resolve) => window.setTimeout(resolve, 18))
        }
      } finally {
        if (!cancelled) controller.close()
      }
    },
    cancel() { cancelled = true },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export function AIChatPanel({ kind, chatId, topicId, questionId, initialMessages, title, detail, compact = false, onMessagesChange, onTopicUpdated, workspace = false, active = true, mode = 'coach', activity, learnerAnswer, review, onActivate, onSupport, disabled = false, turnContext }: AIChatProps) {
  const [input, setInput] = useState('')
  const [localError, setLocalError] = useState('')
  const [initial] = useState(() => toUiMessages(initialMessages))
  const transcriptRef = useRef<HTMLDivElement>(null)
  const transport = useMemo(() => new TextStreamChatTransport({
    api: kind === 'scope' ? getApiUrl(`/topics/${encodeURIComponent(topicId ?? '')}/scope/stream`) : getApiUrl('/tutor/stream'),
    body: { topicId, questionId, context: workspace ? { activity, learnerAnswer, review, learningMode: mode, turnContext } : undefined },
    fetch: async (input, init) => {
      if (!isDemoMode) return window.fetch(input, init)
      let body: { messages?: UIMessage[] } = {}
      try { body = JSON.parse(String(init?.body ?? '{}')) as typeof body } catch { /* The demo falls back to a clear empty-message response. */ }
      const messages = body.messages ?? []
      const lastUser = [...messages].reverse().find((message) => message.role === 'user')
      const text = lastUser?.parts.flatMap((part) => part.type === 'text' ? [part.text] : []).join('').trim() ?? ''
      if (!text) return streamResponse('Erzähl mir etwas mehr, damit ich dich sinnvoll unterstützen kann.', init?.signal ?? undefined)
      try {
        if (kind === 'scope' && topicId) {
          const history = messages.flatMap((message) => {
            if (message.role !== 'user' && message.role !== 'assistant') return []
            return [{ id: message.id, role: message.role, text: message.parts.flatMap((part) => part.type === 'text' ? [part.text] : []).join('') }]
          })
          const result = await learningApi.scopeTopic(topicId, text, history)
          onTopicUpdated?.(result.topic)
          return streamResponse(result.assistantMessage, init?.signal ?? undefined)
        }
        if (questionId) {
          if (activity) {
            const level = Math.max(0, messages.filter((message) => message.role === 'user').length - 1)
            if (!review && /erkläre das prinzip/i.test(text)) {
              const theory = theoryFor(activity)
              return streamResponse(`${theory.principle} ${theory.takeaway}`, init?.signal ?? undefined)
            }
            return streamResponse(coachReply(activity, text, level, review), init?.signal ?? undefined)
          }
          const response = await learningApi.sendTutorMessage(questionId, text)
          return streamResponse(response.text, init?.signal ?? undefined)
        }
        return streamResponse('Der KI-Coach ist noch nicht mit einer Aufgabe verbunden.', init?.signal ?? undefined)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Der Lernassistent ist im Moment nicht verfügbar.'
        return new Response(message, { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
    },
  }), [kind, onTopicUpdated, questionId, topicId, workspace, activity, learnerAnswer, review, mode, turnContext])

  const { messages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    messages: initial,
    transport,
    onError: (cause) => setLocalError(cause.message),
    onFinish: () => {
      setLocalError('')
      if (kind === 'scope' && !isDemoMode && topicId) {
        void learningApi.getTopic(topicId).then((topic) => onTopicUpdated?.(topic)).catch((cause: unknown) => {
          setLocalError(cause instanceof Error ? cause.message : 'The updated learning plan could not be loaded.')
        })
      }
    },
  })
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    onMessagesChange?.(toAppMessages(messages))
  }, [messages, onMessagesChange])

  useEffect(() => {
    const transcript = transcriptRef.current
    if (transcript) transcript.scrollTop = transcript.scrollHeight
  }, [messages, busy])

  function send(text: string) {
    if (!text.trim() || busy || disabled || !active && !onActivate) return
    if (!active) onActivate?.()
    setLocalError('')
    setInput('')
    onSupport?.()
    void sendMessage({ text: text.trim() })
  }

  if (workspace) return <div>
    <LearningSurface className="learn-coach">
      <div className="learn-coach-header"><div className="learn-coach-identity"><span className="learn-coach-mark"><MessagesSquare className="size-4" /></span><div><h2>{title}</h2><p><span className="learn-status-dot" />{!active ? 'Bei Bedarf dazuholen' : mode === 'together' ? 'Auch zu zweit für euch da' : 'An deiner Seite'}</p></div></div></div>
      {!active ? <div className="learn-coach-closed"><Button variant="outline" disabled={disabled || !onActivate} onClick={onActivate}>Coach hinzunehmen <ArrowUpRight className="size-3.5" /></Button></div> : <>
        <div ref={transcriptRef} className="learn-coach-transcript" role="log" aria-label="Gespräch mit dem KI-Coach" aria-live="polite" aria-relevant="additions">
          {messages.map((message) => <div key={message.id} className={`learn-message ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}><p className="learn-message-label">{message.role === 'user' ? 'Du' : 'KI-Coach'}</p>{message.parts.map((part, index) => part.type === 'text' ? <span key={index}>{part.text}</span> : null)}</div>)}
          {busy && <span className="learn-loading" role="status"><LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" /> Ein Gedanke entsteht …</span>}
        </div>
        <div className="learn-coach-prompts">{[review ? 'Feedback erklären' : 'Gib mir einen Denkimpuls', 'Erkläre das Prinzip'].map((prompt) => <Button key={prompt} variant="outline" size="sm" disabled={busy || disabled || !active && !onActivate} onClick={() => send(prompt)}>{prompt}</Button>)}</div>
        <div className="learn-coach-bottom">{(localError || error) && <p className="learn-inline-error" role="alert">Der Coach konnte nicht antworten. Deine Nachricht bleibt im Verlauf. Bitte versuche es erneut.</p>}
          <form className="learn-coach-form" onSubmit={(event) => { event.preventDefault(); send(input) }}><Textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} aria-label="Den KI-Coach fragen" placeholder="Wo kommst du gerade nicht weiter?" disabled={busy || disabled || !active && !onActivate} />{busy ? <Button type="button" variant="outline" size="icon-lg" onClick={() => void stop()} aria-label="Antwort anhalten"><XIcon /></Button> : <Button variant="primary" type="submit" size="icon-lg" aria-label="Nachricht senden" disabled={disabled || !input.trim() || !active && !onActivate}><ArrowUp className="size-4" /></Button>}</form>
          <small>KI kann sich irren. Prüfe Aussagen am Material.</small>
        </div>
      </>}
    </LearningSurface>
  </div>

  return <Card className={`panel min-w-0 ${compact ? 'p-4' : ''}`}>
    <div className="flex items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Sparkles className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0"><h2 className="text-sm font-semibold">{title}</h2><p className="text-[10px] text-muted-foreground">{detail}</p></div>
    </div>
    <div className={`chat-transcript mt-4 space-y-3 overflow-y-auto ${compact ? 'max-h-56' : 'max-h-72'}`} aria-live="polite">
      {messages.map((message) => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
          {message.parts.map((part, index) => part.type === 'text' ? <span key={`${message.id}-${index}`}>{part.text}</span> : null)}
        </div>
      </div>)}
      {busy && <LoadingInline label={kind === 'scope' ? 'Lernpfad wird angepasst …' : 'Hinweis wird vorbereitet …'} />}
    </div>
    {(localError || error) && <p className="mt-3 text-xs text-destructive" role="alert">{localError || error?.message}</p>}
    <form onSubmit={(event) => {
      event.preventDefault()
      const text = input.trim()
      if (!text || busy) return
      setLocalError('')
      setInput('')
      void sendMessage({ text })
    }} className="mt-4 flex items-end gap-2">
      {kind === 'scope'
        ? <Textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} required disabled={busy} className="min-h-12 resize-none rounded-xl" aria-label="Lernfokus anpassen" placeholder="Bitte um einen anderen Fokus, ein anderes Tempo oder korrigiere eine Lernangabe …" />
        : <Input value={input} onChange={(event) => setInput(event.target.value)} required disabled={busy} className="h-11 rounded-xl" aria-label="Den KI-Coach fragen" placeholder="Was ist noch unklar?" />}
      <Button variant="primary" type="submit" size="icon-lg" aria-label="Nachricht senden" disabled={busy || !input.trim()}><ArrowUp className="size-4" aria-hidden="true" /></Button>
    </form>
    {kind === 'tutor' && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Du behältst die Kontrolle. Der Coach unterstützt dein Denken, die Antwort formulierst du selbst.</p>}
    {kind === 'scope' && <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Die Lernangaben kannst du auch weiter unten bearbeiten. Bis der FastAPI-Stream verbunden ist, nutzt die Demo vorbereitete Antworten.</p>}
  </Card>
}

function XIcon() { return <span aria-hidden="true" className="size-2.5 rounded-sm bg-current" /> }
