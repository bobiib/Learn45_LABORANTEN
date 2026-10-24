import { initialDashboard, initialTopic, createTopicFromFile, refreshEligibility } from './fixtures'
import type { AnswerSubmission, ChatMessage, DashboardData, ReviewResult, SetupResult, Topic } from './types'

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
  deleteTopic(topicId: string, signal?: AbortSignal): Promise<void>
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

const deletedTopicsStorageKey = 'learn45.deleted-topics.v1'
export function getDeletedTopicIds(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(deletedTopicsStorageKey) ?? '[]') as unknown
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

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
    if (topicId === initialTopic.id) return structuredClone(initialTopic)
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
  async deleteTopic(topicId, signal) {
    await pause(signal, 320)
    const deleted = new Set(getDeletedTopicIds())
    deleted.add(topicId)
    window.localStorage.setItem(deletedTopicsStorageKey, JSON.stringify([...deleted]))
    window.localStorage.removeItem(`learn45.topic.${topicId}`)
    window.localStorage.removeItem(`learn45.topic.ready.${topicId}`)
  },
  async scopeTopic(topicId, message, history, signal) {
    await pause(signal, 950)
    const topic = await this.getTopic(topicId, signal)
    const narrowed = /exam|week|test|important|focus/i.test(message)
    const assistantMessage = narrowed
      ? 'Got it. I’ll focus on the parts most useful for your goal and keep each practice step short. I’ve prepared a sample learning path for this demo; you can change these details any time.'
      : 'Thanks, that helps me understand what matters to you. Which outcome would make these notes most useful: remembering key ideas, explaining them, or applying them to a task?'
    return { topic: { ...topic, description: message || topic.description }, assistantMessage }
  },
  async updateContext(_topicId, context, signal) {
    await pause(signal, 320)
    return context
  },
  async submitAnswer(input, signal) {
    await pause(signal, 1150)
    const answer = input.answer.toLowerCase()
    const mentionsOutcome = /reader|lead|audience|action|decision|next step|owner|include|criteria/i.test(answer)
    const detailed = answer.trim().split(/\s+/).length >= 12
    const correctness = mentionsOutcome && detailed ? 'strong' : mentionsOutcome || detailed ? 'partial' : 'incorrect'
    const hintPenalty = input.hintsUsed > 0 || input.tutorUsed
    if (correctness === 'strong') return {
      correctness,
      headline: 'A clear start with a useful purpose',
      feedback: 'You named a concrete audience or outcome and gave the AI enough direction to make the summary actionable. Next, check whether the requested details can be verified against the notes.',
      evidenceLabel: hintPenalty ? 'Strong evidence · coached practice' : 'Strong independent evidence',
      evidenceDelta: hintPenalty ? 8 : 14,
      nextActivity: 'Make the success criteria checkable',
      nextReason: 'Your prompt has a clear audience. The next step is to specify which evidence should appear so Lea can judge the summary reliably.',
      nextQuestionId: input.questionId === 'q-criteria' ? 'q-revise' : 'q-criteria',
    }
    if (correctness === 'partial') return {
      correctness,
      headline: 'You have part of the prompt in place',
      feedback: 'There is a useful detail here. Add the missing audience, outcome, or checkable requirement, then compare the revised prompt with the source notes.',
      evidenceLabel: hintPenalty ? 'Some evidence · with coaching' : 'Some independent evidence',
      evidenceDelta: hintPenalty ? 3 : 6,
      nextActivity: 'Add one specific quality criterion',
      nextReason: 'This attempt shows partial understanding. One more concrete requirement will make the next practice question a good fit.',
      nextQuestionId: 'q-criteria',
    }
    return {
      correctness,
      headline: 'Let’s make the goal more concrete',
      feedback: 'The answer does not yet name a reader, outcome, or requirement. Look back at who will use the summary and what they need to do with it; try again with a little more detail.',
      evidenceLabel: 'Practice attempt saved · progress unchanged',
      evidenceDelta: 0,
      nextActivity: 'Try a shorter question about the reader',
      nextReason: 'This attempt suggests the audience is still unclear. A smaller step can help before returning to the full prompt.',
      nextQuestionId: 'q-goal',
    }
  },
  async sendTutorMessage(_questionId, message, signal) {
    await pause(signal, 800)
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: /audience|reader|lead/i.test(message)
        ? 'Think about the person who receives the summary. What decision or action should they be able to take after reading it?'
        : /include|criteria|check/i.test(message)
          ? 'Try naming two details that would make the summary useful and easy to verify, such as decisions and owners.'
          : 'What do you already know about the reader and the purpose of this summary? Start there, then add one detail the AI can check against the notes.',
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
    if (response.status === 204) return undefined as T
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
  deleteTopic: (id, signal) => request(`/topics/${encodeURIComponent(id)}`, { method: 'DELETE' }, signal),
  scopeTopic: (id, message, history, signal) => request(`/topics/${encodeURIComponent(id)}/scope`, { method: 'POST', body: JSON.stringify({ message, history }) }, signal),
  updateContext: (id, context, signal) => request(`/topics/${encodeURIComponent(id)}/context`, { method: 'PATCH', body: JSON.stringify(context) }, signal),
  submitAnswer: (input, signal) => request('/questions/answer', { method: 'POST', body: JSON.stringify(input) }, signal),
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
