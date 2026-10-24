import { initialDashboard, createTopicFromFile, refreshEligibility } from './fixtures'
import type { AnswerSubmission, ChatMessage, DashboardData, ReviewResult, SetupResult, Topic } from './types'
import { evaluatePractice } from './learning-engine'

/**
 * Frontend contract for the learning backend. UI components call this interface
 * only; switch VITE_DEMO_MODE=false once the FastAPI routes are ready.
 */
export interface LearningApi {
  getDashboard(signal?: AbortSignal): Promise<DashboardData>
  updateWeeklyGoal(minutes: number, signal?: AbortSignal): Promise<number>
  getTopic(topicId: string, signal?: AbortSignal): Promise<Topic>
  uploadSource(file: File, topicId?: string, signal?: AbortSignal): Promise<Topic>
  renameSource(topicId: string, sourceId: string, name: string, signal?: AbortSignal): Promise<Topic>
  deleteSource(topicId: string, sourceId: string, signal?: AbortSignal): Promise<Topic>
  scopeTopic(topicId: string, message: string, history: ChatMessage[], signal?: AbortSignal): Promise<SetupResult>
  updateContext(topicId: string, context: Topic['context'], signal?: AbortSignal): Promise<Topic['context']>
  submitAnswer(input: AnswerSubmission, signal?: AbortSignal): Promise<ReviewResult>
  rateDifficulty(questionId: string, difficulty: NonNullable<AnswerSubmission['difficulty']>, signal?: AbortSignal): Promise<void>
  sendTutorMessage(questionId: string, message: string, signal?: AbortSignal): Promise<ChatMessage>
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

const pause = (signal?: AbortSignal, ms = 550) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => {
    window.clearTimeout(timer)
    reject(new DOMException('Request cancelled', 'AbortError'))
  }, { once: true })
})

const demoApi: LearningApi = {
  async getDashboard(signal) {
    await pause(signal, 420)
    const dashboard = structuredClone(initialDashboard)
    const savedGoal = window.localStorage.getItem('learn45.weekly-goal.v1')
    if (savedGoal) dashboard.weeklyGoalMinutes = Number(savedGoal) || dashboard.weeklyGoalMinutes
    return dashboard
  },
  async updateWeeklyGoal(minutes, signal) {
    await pause(signal, 260)
    window.localStorage.setItem('learn45.weekly-goal.v1', String(minutes))
    return minutes
  },
  async getTopic(topicId, signal) {
    await pause(signal, 360)
    const cached = window.localStorage.getItem(`learn45.topic.${topicId}`)
    if (cached) return JSON.parse(cached) as Topic
    const seeded = initialDashboard.topics.find((topic) => topic.id === topicId)
    if (seeded) return structuredClone(seeded)
    throw new ApiError('We could not find this learning topic.', 404)
  },
  async uploadSource(file, topicId, signal) {
    await pause(signal, 1050)
    if (topicId) {
      const topic = await this.getTopic(topicId, signal)
      const updated = { ...topic, sources: [...topic.sources, { id: `source-${Date.now()}`, name: file.name, kind: file.name.split('.').pop()?.toUpperCase() ?? 'FILE', sizeLabel: 'Ready to process', addedLabel: 'Just added' }] }
      window.localStorage.setItem(`learn45.topic.${topicId}`, JSON.stringify(updated))
      return updated
    }
    const topic = createTopicFromFile(file.name)
    window.localStorage.setItem(`learn45.topic.${topic.id}`, JSON.stringify(topic))
    return topic
  },
  async renameSource(topicId, sourceId, name, signal) {
    await pause(signal, 300)
    const topic = await this.getTopic(topicId, signal)
    const updated = { ...topic, sources: topic.sources.map((source) => source.id === sourceId ? { ...source, name } : source) }
    window.localStorage.setItem(`learn45.topic.${topicId}`, JSON.stringify(updated))
    return updated
  },
  async deleteSource(topicId, sourceId, signal) {
    await pause(signal, 320)
    const topic = await this.getTopic(topicId, signal)
    const updated = { ...topic, sources: topic.sources.filter((source) => source.id !== sourceId) }
    window.localStorage.setItem(`learn45.topic.${topicId}`, JSON.stringify(updated))
    return updated
  },
  async scopeTopic(topicId, message, history, signal) {
    await pause(signal, 950)
    const topic = await this.getTopic(topicId, signal)
    const narrowed = /prüfung|woche|test|wichtig|fokus/i.test(message)
    const assistantMessage = narrowed
      ? 'Verstanden. Ich konzentriere mich auf die Teile, die für dein Ziel besonders nützlich sind, und halte die Übungsschritte kurz. Für diese Demo habe ich einen beispielhaften Lernpfad vorbereitet; du kannst die Angaben jederzeit anpassen.'
      : 'Danke, das hilft mir zu verstehen, was dir wichtig ist. Welches Ergebnis wäre mit diesen Notizen am wertvollsten: zentrale Ideen erinnern, sie erklären oder sie in einer Aufgabe anwenden?'
    return { topic: { ...topic, description: message || topic.description }, assistantMessage }
  },
  async updateContext(_topicId, context, signal) {
    await pause(signal, 320)
    return context
  },
  async submitAnswer(input, signal) {
    await pause(signal, 1150)
    return evaluatePractice(input)
  },
  async sendTutorMessage(_questionId, message, signal) {
    await pause(signal, 800)
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: /zielgruppe|leser|leserin|projektleitung/i.test(message)
        ? 'Denk an die Person, die die Zusammenfassung erhält. Welche Entscheidung oder Handlung soll nach dem Lesen möglich sein?'
        : /enthalt|kriter|prüf/i.test(message)
          ? 'Nenne zwei Details, die die Zusammenfassung nützlich und leicht überprüfbar machen – zum Beispiel Entscheidungen und Zuständigkeiten.'
          : 'Was weisst du schon über die lesende Person und den Zweck dieser Zusammenfassung? Beginne dort und ergänze dann ein Detail, das die KI an den Notizen prüfen kann.',
    }
  },
  async rateDifficulty(questionId, difficulty, signal) {
    await pause(signal, 220)
    window.localStorage.setItem(`learn45.difficulty.${questionId}`, difficulty)
  },
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '')
export const getApiUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
const withTimeout = (parent?: AbortSignal, ms = 15000) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), ms)
  parent?.addEventListener('abort', () => controller.abort(parent.reason), { once: true })
  return { signal: controller.signal, cleanup: () => window.clearTimeout(timer) }
}

async function request<T>(path: string, init: RequestInit = {}, parent?: AbortSignal): Promise<T> {
  const timeout = withTimeout(parent)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: timeout.signal,
      headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { detail?: string; message?: string }
      throw new ApiError(payload.detail ?? payload.message ?? `Request failed (${response.status})`, response.status)
    }
    return await response.json() as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (timeout.signal.aborted && timeout.signal.reason?.name === 'TimeoutError') throw new ApiError('The server took too long to respond. Please try again.')
    throw new ApiError('Could not reach the learning service. Check your connection and try again.')
  } finally {
    timeout.cleanup()
  }
}

const backendApi: LearningApi = {
  getDashboard: (signal) => request('/dashboard', {}, signal),
  async updateWeeklyGoal(minutes, signal) {
    const result = await request<{ weeklyGoalMinutes: number }>('/learner/weekly-goal', { method: 'PATCH', body: JSON.stringify({ weeklyGoalMinutes: minutes }) }, signal)
    return result.weeklyGoalMinutes
  },
  getTopic: (id, signal) => request(`/topics/${encodeURIComponent(id)}`, {}, signal),
  async uploadSource(file, topicId, signal) {
    const body = new FormData()
    body.append('file', file)
    return topicId
      ? request(`/topics/${encodeURIComponent(topicId)}/sources`, { method: 'POST', body }, signal)
      : request('/topics/sources', { method: 'POST', body }, signal)
  },
  renameSource: (topicId, sourceId, name, signal) => request(`/topics/${encodeURIComponent(topicId)}/sources/${encodeURIComponent(sourceId)}`, { method: 'PATCH', body: JSON.stringify({ name }) }, signal),
  deleteSource: (topicId, sourceId, signal) => request(`/topics/${encodeURIComponent(topicId)}/sources/${encodeURIComponent(sourceId)}`, { method: 'DELETE' }, signal),
  scopeTopic: (id, message, history, signal) => request(`/topics/${encodeURIComponent(id)}/scope`, { method: 'POST', body: JSON.stringify({ message, history }) }, signal),
  updateContext: (id, context, signal) => request(`/topics/${encodeURIComponent(id)}/context`, { method: 'PATCH', body: JSON.stringify(context) }, signal),
  submitAnswer: (input, signal) => {
    const { attachment, ...payloadWithText } = input
    const payload = { ...payloadWithText, attachmentText: undefined }
    if (attachment) {
      const body = new FormData()
      body.append('file', attachment)
      body.append('submission', JSON.stringify(payload))
      return request('/questions/answer', { method: 'POST', body }, signal)
    }
    return request('/questions/answer', { method: 'POST', body: JSON.stringify(payload) }, signal)
  },
  async rateDifficulty(questionId, difficulty, signal) {
    await request(`/questions/${encodeURIComponent(questionId)}/difficulty`, { method: 'PATCH', body: JSON.stringify({ difficulty }) }, signal)
  },
  sendTutorMessage: (questionId, message, signal) => request('/tutor/messages', { method: 'POST', body: JSON.stringify({ questionId, message }) }, signal),
}

export const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false'
export const learningApi: LearningApi = isDemoMode ? demoApi : backendApi

export function getStoredTopic(topicId: string): Topic | null {
  try {
    const saved = window.localStorage.getItem(`learn45.topic.${topicId}`)
    return saved ? JSON.parse(saved) as Topic : null
  } catch {
    return null
  }
}

export function saveStoredTopic(topic: Topic) {
  window.localStorage.setItem(`learn45.topic.${topic.id}`, JSON.stringify(refreshEligibility(topic)))
}
