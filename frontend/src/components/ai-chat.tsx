import { useEffect, useMemo, useState } from 'react'
import { TextStreamChatTransport, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { ArrowUp } from 'lucide-react'
import { AIConfirmationDialog } from '@/components/ui/ai-confirmation-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LoadingInline } from '@/components/feedback'
import { isDemoMode, learningApi, getApiUrl } from '@/lib/api'
import type { ChatMessage, Topic } from '@/lib/types'

type ChatKind = 'tutor' | 'scope'

type AIChatProps = {
  kind: ChatKind
  chatId: string
  topicId?: string
  questionId?: string
  initialMessages: ChatMessage[]
  eyebrow?: string
  title: string
  detail: string
  compact?: boolean
  planGenerated?: boolean
  inputId?: string
  placeholder?: string
  onMessagesChange?: (messages: ChatMessage[]) => void
  onTopicUpdated?: (topic: Topic) => void
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
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const piece of pieces) {
          if (signal?.aborted) break
          controller.enqueue(encoder.encode(piece))
          await new Promise((resolve) => window.setTimeout(resolve, 18))
        }
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export function AIChatPanel({
  kind,
  chatId,
  topicId,
  questionId,
  initialMessages,
  title,
  detail,
  compact = false,
  planGenerated = false,
  inputId,
  placeholder,
  onMessagesChange,
  onTopicUpdated,
}: AIChatProps) {
  const [input, setInput] = useState('')
  const [pendingText, setPendingText] = useState('')
  const [localError, setLocalError] = useState('')
  const initial = useMemo(() => toUiMessages(initialMessages), [chatId])
  const transport = useMemo(() => new TextStreamChatTransport({
    api: kind === 'scope' ? getApiUrl(`/topics/${encodeURIComponent(topicId ?? '')}/scope/stream`) : getApiUrl('/tutor/stream'),
    body: { topicId, questionId },
    fetch: async (input, init) => {
      if (!isDemoMode) return window.fetch(input, init)
      let body: { messages?: UIMessage[] } = {}
      try { body = JSON.parse(String(init?.body ?? '{}')) as typeof body } catch { /* The demo falls back to a clear empty-message response. */ }
      const messages = body.messages ?? []
      const lastUser = [...messages].reverse().find((message) => message.role === 'user')
      const text = lastUser?.parts.flatMap((part) => part.type === 'text' ? [part.text] : []).join('').trim() ?? ''
      if (!text) return streamResponse('Erzähl mir noch etwas mehr, damit ich dir helfen kann.', init?.signal ?? undefined)
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
          const response = await learningApi.sendTutorMessage(questionId, text)
          return streamResponse(response.text, init?.signal ?? undefined)
        }
        return streamResponse('Der KI-Coach ist noch keiner Frage zugeordnet.', init?.signal ?? undefined)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Der Lerncoach ist gerade nicht verfügbar.'
        return new Response(message, { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
    },
  }), [chatId, kind, onTopicUpdated, questionId, topicId])

  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    messages: initial,
    transport,
    onError: (cause) => setLocalError(cause.message),
    onFinish: () => {
      setLocalError('')
      if (kind === 'scope' && !isDemoMode && topicId) {
        void learningApi.getTopic(topicId).then((topic) => onTopicUpdated?.(topic)).catch((cause: unknown) => {
          setLocalError(cause instanceof Error ? cause.message : 'Der aktualisierte Lernpfad konnte nicht geladen werden.')
        })
      }
    },
  })
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    onMessagesChange?.(toAppMessages(messages))
  }, [messages, onMessagesChange])

  return <Card className={`panel min-w-0 ${compact ? 'p-4' : ''}`}>
    <div className="min-w-0">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
    <div className={`chat-transcript mt-3.5 space-y-2.5 overflow-y-auto ${compact ? 'max-h-64' : 'max-h-72'}`} aria-live="polite">
      {messages.map((message) => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3.5 py-2 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
          {message.parts.map((part, index) => part.type === 'text' ? <span key={`${message.id}-${index}`}>{part.text}</span> : null)}
        </div>
      </div>)}
      {busy && <LoadingInline label={kind === 'scope' ? 'Lernpfad wird aktualisiert…' : 'Hinweis wird vorbereitet…'} />}
    </div>
    {(localError || error) && <p className="mt-3 text-xs text-destructive" role="alert">{localError || error?.message}</p>}
    <form onSubmit={(event) => {
      event.preventDefault()
      const text = input.trim()
      if (!text || busy || planGenerated) return
      setLocalError('')
      if (isDemoMode) {
        setInput('')
        void sendMessage({ text })
      } else {
        setPendingText(text)
      }
    }} className="mt-3.5 flex items-end gap-2">
      {kind === 'scope'
        ? <Textarea id={inputId} value={input} onChange={(event) => setInput(event.target.value)} rows={2} required disabled={busy || planGenerated} className="min-h-11 resize-none rounded-lg" aria-label="Sag dem Lerncoach, was du anpassen möchtest" placeholder={placeholder ?? 'Sag der KI, welche Themen du lernen, ergänzen oder entfernen möchtest…'} />
        : <Input id={inputId} value={input} onChange={(event) => setInput(event.target.value)} required disabled={busy} className="h-10 rounded-lg" aria-label="Den KI-Coach fragen" placeholder={placeholder ?? 'Was ist gerade schwierig?'} />}
      <Button variant="primary" type="submit" size="icon-lg" aria-label="Nachricht senden" disabled={busy || planGenerated || !input.trim()}><ArrowUp className="size-4" aria-hidden="true" /></Button>
    </form>
    {kind === 'tutor' && <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Du entscheidest: Schließe den KI-Coach jederzeit und übe selbstständig weiter.{!isDemoMode && ' Tutor-Nachrichten werden an Gemini gesendet und nicht in Leas Chatverlauf gespeichert.'}</p>}
    {kind === 'scope' && planGenerated && <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Dein Lernpfad ist bereit. Öffne ihn, um die Schritte und Fragen zu prüfen.</p>}
    <AIConfirmationDialog
      open={Boolean(pendingText)}
      title={kind === 'scope' ? 'Lernpfad mit KI erstellen?' : 'Nachricht an den KI-Coach senden?'}
      description={kind === 'scope' ? 'Lea verwendet Gemini, um aus deinen Notizen und deinem Lernziel einen ersten Lernpfad zu erstellen.' : 'Der KI-Coach verwendet den Kontext dieser Lerneinheit für seine Antwort.'}
      details={kind === 'scope' ? 'Deine hochgeladenen Notizen, dein Lernziel und der bisherige Einrichtungschat werden gesendet. Der Chatverlauf wird nicht in Lea gespeichert.' : 'Deine Nachricht, die Frage und relevante Auszüge aus deinen Lernnotizen werden gesendet. Der Chatverlauf wird nicht in Lea gespeichert.'}
      onCancel={() => setPendingText('')}
      onConfirm={() => { const text = pendingText; setPendingText(''); setInput(''); void sendMessage({ text }) }}
    />
  </Card>
}
