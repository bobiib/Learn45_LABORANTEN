import { useEffect, useMemo, useState } from 'react'
import { TextStreamChatTransport, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { ArrowUp, Sparkles } from 'lucide-react'
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
  title: string
  detail: string
  compact?: boolean
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

export function AIChatPanel({ kind, chatId, topicId, questionId, initialMessages, title, detail, compact = false, onMessagesChange, onTopicUpdated }: AIChatProps) {
  const [input, setInput] = useState('')
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
      if (!text) return streamResponse('Tell me a little more so I can help.', init?.signal ?? undefined)
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
        return streamResponse('The tutor is not connected to a question yet.', init?.signal ?? undefined)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The learning assistant is unavailable.'
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
          setLocalError(cause instanceof Error ? cause.message : 'The updated learning plan could not be loaded.')
        })
      }
    },
  })
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    onMessagesChange?.(toAppMessages(messages))
  }, [messages, onMessagesChange])

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
      {busy && <LoadingInline label={kind === 'scope' ? 'Updating your learning plan…' : 'Thinking through a hint…'} />}
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
        ? <Textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} required disabled={busy} className="min-h-12 resize-none rounded-xl" aria-label="Tell the learning partner what to adjust" placeholder="Ask to focus on a topic, adjust the pace, or correct a learning fact…" />
        : <Input value={input} onChange={(event) => setInput(event.target.value)} required disabled={busy} className="h-11 rounded-xl" aria-label="Ask the AI tutor" placeholder="What feels tricky?" />}
      <Button variant="primary" type="submit" size="icon-lg" aria-label="Send message" disabled={busy || !input.trim()}><ArrowUp className="size-4" aria-hidden="true" /></Button>
    </form>
    {kind === 'tutor' && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">You stay in control. Close the tutor any time and answer independently.</p>}
    {kind === 'scope' && <p className="mt-2 text-[10px] leading-5 text-muted-foreground">You can also edit the learning facts below. Responses are scripted locally until the FastAPI stream is connected.</p>}
  </Card>
}
