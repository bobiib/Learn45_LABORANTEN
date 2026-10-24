import { initialDashboard, initialTopic, buildScopedPlanFromMessage, createTopicFromFile, refreshEligibility } from './fixtures'
import type { AnswerSubmission, ChatMessage, DashboardData, LearningQuestion, QuestionRecommendation, ReviewResult, SetupResult, Topic, TopicChangeSet, TopicProposalResult } from './types'

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
  proposeTopicChanges(topicId: string, messages: ChatMessage[], signal?: AbortSignal): Promise<TopicProposalResult>
  applyTopicChanges(topicId: string, proposal: TopicChangeSet, signal?: AbortSignal): Promise<Topic>
  updateContext(topicId: string, context: Topic['context'], signal?: AbortSignal): Promise<Topic['context']>
  submitAnswer(input: AnswerSubmission, signal?: AbortSignal): Promise<ReviewResult>
  recommendQuestion(topicId: string, signal?: AbortSignal): Promise<QuestionRecommendation>
  generateNodeQuestion(topicId: string, nodeId: string, signal?: AbortSignal): Promise<Topic>
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
    await pause(signal, 850)
    const topic = await this.getTopic(topicId, signal)
    const result = buildScopedPlanFromMessage(topic, message)
    window.localStorage.setItem(`learn45.topic.${topicId}`, JSON.stringify(result.topic))
    return result
  },
  async proposeTopicChanges(topicId, messages, signal) {
    await pause(signal, 700)
    const topic = await this.getTopic(topicId, signal)
    const text = messages.at(-1)?.text ?? ''
    const changes: TopicChangeSet = { assistantMessage: 'Ich habe einen Vorschlag vorbereitet. Prüfe ihn, bevor du ihn übernimmst.', proposalType: 'requested', baseVersion: 'demo', topic: {}, context: {}, nodes: [], questions: [], addNodes: [], addQuestions: [], deleteNodeIds: [], deleteQuestionIds: [] }
    const focus = text.match(/(?:focus|fokus|schwerpunkt)\s+(?:to|on|auf|ist)\s+(.+)/i)?.[1]?.trim()
    const time = text.match(/(?:time available|study time|lernzeit|lerndauer)\s+(?:to|is|auf|beträgt)\s+(.+)/i)?.[1]?.trim()
    const examDate = text.match(/(?:exam date|prüfungstermin|prüfung)\s+(?:to|is|auf|am)\s+(\d{4}-\d{2}-\d{2})/i)?.[1]
    if (focus) changes.context.focus = focus
    if (time) changes.context.timeAvailable = time
    if (examDate) changes.context.examDate = examDate
    const tutorSetting = text.match(/(?:tutor|ki-coach)\s+(on|off|enabled|disabled|an|aus|aktiv|deaktiviert)/i)?.[1]?.toLowerCase()
    if (tutorSetting) changes.context.tutorEnabled = ['on', 'enabled', 'an', 'aktiv'].includes(tutorSetting)
    if (!Object.keys(changes.context).length) changes.assistantMessage = `Ich kann „${topic.title}“ anpassen. Im Demo kannst du zum Beispiel schreiben: „Schwerpunkt auf Zellaufbau setzen“ oder „Lernzeit auf 30 Minuten pro Tag setzen“.`
    else changes.assistantMessage = 'Hier ist der erkannte Änderungsvorschlag. Prüfe ihn und bestätige ihn, um ihn zu speichern.'
    return { assistantMessage: changes.assistantMessage, proposal: changes }
  },
  async applyTopicChanges(topicId, proposal, signal) {
    await pause(signal, 320)
    const topic = await this.getTopic(topicId, signal)
    if (proposal.deleteNodeIds.some((id) => (topic.nodes.find((node) => node.id === id)?.progress ?? 0) > 0)) throw new ApiError('A learning step with recorded progress cannot be deleted.', 409)
    if (topic.nodes.some((node) => !proposal.deleteNodeIds.includes(node.id) && node.prerequisites.some((id) => proposal.deleteNodeIds.includes(id)))) throw new ApiError('A learning step used as a prerequisite cannot be deleted until dependent steps are changed.', 409)
    if (proposal.deleteQuestionIds.some((id) => topic.questions.find((question) => question.id === id)?.status === 'completed')) throw new ApiError('A question with recorded practice cannot be deleted.', 409)
    const removedNodeQuestions = topic.questions.filter((question) => proposal.deleteNodeIds.includes(question.topicId)).map((question) => question.id)
    if (removedNodeQuestions.some((id) => !proposal.deleteQuestionIds.includes(id))) throw new ApiError('Deleting a learning step also requires deleting its practice questions.', 422)
    const addedNodeIds = new Map(proposal.addNodes.map((node) => [node.key, node.key]))
    const nodes = topic.nodes.filter((node) => !proposal.deleteNodeIds.includes(node.id)).map((node) => {
      const change = proposal.nodes.find((item) => item.id === node.id)
      return change ? { ...node, ...Object.fromEntries(Object.entries(change).filter(([key, value]) => key !== 'id' && value !== undefined && value !== null)) } : node
    }).concat(proposal.addNodes.map((node) => ({
      id: addedNodeIds.get(node.key)!, label: node.label, description: node.description,
      prerequisites: node.prerequisites.map((id) => addedNodeIds.get(id) ?? id), progress: 0,
      eligible: node.prerequisites.length === 0,
      evidence: { Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0 },
    })))
    const questions = topic.questions.filter((question) => !proposal.deleteQuestionIds.includes(question.id)).map((question) => {
      const change = proposal.questions.find((item) => item.id === question.id)
      return change ? { ...question, ...Object.fromEntries(Object.entries(change).filter(([key, value]) => key !== 'id' && key !== 'durationMinutes' && value !== undefined && value !== null)), ...(change.durationMinutes ? { duration: `${change.durationMinutes} min` } : {}) } : question
    }).concat(proposal.addQuestions.map((question, index) => ({
      id: `question-demo-${Date.now()}-${index}`, topicId: addedNodeIds.get(question.nodeRef) ?? question.nodeRef,
      title: question.title, prompt: question.prompt, stage: question.stage, mode: question.mode, sources: question.sources,
      duration: `${question.durationMinutes} min`, status: 'up-next' as const,
    })))
    const next: Topic = {
      ...topic,
      title: proposal.topic.title ?? topic.title,
      subject: proposal.topic.subject ?? topic.subject,
      description: proposal.topic.description ?? topic.description,
      context: { ...topic.context, ...Object.fromEntries(Object.entries(proposal.context).filter(([, value]) => value !== undefined && value !== null)) },
      nodes,
      questions,
    }
    saveStoredTopic(next)
    return next
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
    let result: ReviewResult
    if (correctness === 'strong') result = {
      correctness,
      estimatedPointsPercent: hintPenalty ? 82 : 94,
      headline: 'A clear start with a useful purpose',
      feedback: 'You named a concrete audience or outcome and gave the AI enough direction to make the summary actionable. Next, check whether the requested details can be verified against the notes.',
      evidenceLabel: hintPenalty ? 'Strong evidence · coached practice' : 'Strong independent evidence',
      evidenceDelta: hintPenalty ? 8 : 14,
      nextActivity: 'Make the success criteria checkable',
      nextReason: 'Your prompt has a clear audience. The next step is to specify which evidence should appear so Lea can judge the summary reliably.',
      nextQuestionId: input.questionId === 'q-criteria' ? 'q-revise' : 'q-criteria',
    }
    else if (correctness === 'partial') result = {
      correctness,
      estimatedPointsPercent: hintPenalty ? 48 : 62,
      headline: 'You have part of the prompt in place',
      feedback: 'There is a useful detail here. Add the missing audience, outcome, or checkable requirement, then compare the revised prompt with the source notes.',
      evidenceLabel: hintPenalty ? 'Some evidence · with coaching' : 'Some independent evidence',
      evidenceDelta: hintPenalty ? 3 : 6,
      nextActivity: 'Add one specific quality criterion',
      nextReason: 'This attempt shows partial understanding. One more concrete requirement will make the next practice question a good fit.',
      nextQuestionId: 'q-criteria',
    }
    else result = {
      correctness,
      estimatedPointsPercent: 12,
      headline: 'Let’s make the goal more concrete',
      feedback: 'The answer does not yet name a reader, outcome, or requirement. Look back at who will use the summary and what they need to do with it; try again with a little more detail.',
      evidenceLabel: 'Practice attempt saved · progress unchanged',
      evidenceDelta: 0,
      nextActivity: 'Try a shorter question about the reader',
      nextReason: 'This attempt suggests the audience is still unclear. A smaller step can help before returning to the full prompt.',
      nextQuestionId: 'q-goal',
    }
    const key = `learn45.attempts.${input.questionId}`
    const previous = JSON.parse(window.localStorage.getItem(key) ?? '[]') as { correctness: string; difficulty: string | null }[]
    window.localStorage.setItem(key, JSON.stringify([...previous, { correctness, difficulty: input.difficulty }]))
    return result
  },
  async recommendQuestion(topicId, signal) {
    const topic = await this.getTopic(topicId, signal)
    const eligible = topic.nodes.filter((node) => node.eligible)
    const history = (questionId: string) => JSON.parse(window.localStorage.getItem(`learn45.attempts.${questionId}`) ?? '[]') as { correctness: string; difficulty: string | null }[]
    const weaknesses = (nodeId: string) => {
      const node = topic.nodes.find((item) => item.id === nodeId)
      if (!node) return 0
      let score = Math.max(0, 75 - node.progress) / 75
      for (const question of topic.questions.filter((item) => item.topicId === nodeId)) {
        const attempts = history(question.id)
        const latest = attempts.at(-1)
        if (latest?.correctness === 'incorrect') score += 2
        else if (latest?.correctness === 'partial') score += 1.2
        if (latest?.difficulty === 'too-hard') score += .8
      }
      return score
    }
    const orderedNodes = [...eligible].sort((a, b) => weaknesses(b.id) - weaknesses(a.id) || a.progress - b.progress)
    for (const node of orderedNodes) {
      if (node.progress >= 100 && weaknesses(node.id) < .35) continue
      const question = topic.questions.find((item) => item.topicId === node.id && !history(item.id).length)
      if (question) return { question, reason: weaknesses(node.id) > 1 ? `Recent practice suggests you could use another step on ${node.label}.` : `Build your skills in ${node.label} before moving on.`, generated: false }
    }
    const node = orderedNodes.find((item) => weaknesses(item.id) >= .35 && topic.questions.some((question) => question.topicId === item.id))
    if (!node) return { question: null, reason: 'You have worked through the available questions and there is no unfinished skill that needs another practice question right now.', generated: false }
    const stage = topic.questions.find((question) => question.topicId === node.id)?.stage ?? 'Understand'
    const generated = {
      id: `question-demo-${Date.now()}`, topicId: node.id,
      title: `Fresh practice: ${node.label}`, prompt: `Use the ideas in “${node.label}” to explain one concrete example. What would you do, and why?`,
      stage, mode: 'Solo' as const, duration: '5 min', status: 'recommended' as const,
    }
    const updated = { ...topic, questions: [...topic.questions, generated] }
    saveStoredTopic(updated)
    return { question: generated, reason: `Your progress suggests ${node.label} needs another practice example. I added a fresh question for this demo.`, generated: true }
  },
  async generateNodeQuestion(topicId, nodeId, signal) {
    await pause(signal, 900)
    const topic = await this.getTopic(topicId, signal)
    const node = topic.nodes.find((item) => item.id === nodeId)
    if (!node) throw new ApiError('This learning step could not be found.', 404)
    const generated: LearningQuestion = {
      id: `question-demo-${Date.now()}`, topicId: node.id,
      title: `Practice: ${node.label}`, prompt: `Use the ideas in “${node.label}” to explain one concrete example. What would you do, and why?`,
      stage: topic.questions.find((item) => item.topicId === node.id)?.stage ?? 'Understand',
      mode: 'Solo', duration: '5 min', status: 'up-next',
    }
    const updated = { ...topic, questions: [...topic.questions, generated] }
    saveStoredTopic(updated)
    return updated
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
    const key = `learn45.attempts.${questionId}`
    const history = JSON.parse(window.localStorage.getItem(key) ?? '[]') as { correctness: string; difficulty: string | null }[]
    if (history.length) {
      history[history.length - 1].difficulty = difficulty
      window.localStorage.setItem(key, JSON.stringify(history))
    }
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

async function request<T>(path: string, init: RequestInit = {}, parent?: AbortSignal, timeoutMs = 15000): Promise<T> {
  const timeout = withTimeout(parent, timeoutMs)
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
      ? request(`/topics/${encodeURIComponent(topicId)}/sources`, { method: 'POST', body }, signal, 90000)
      : request('/topics/sources', { method: 'POST', body }, signal, 90000)
  },
  renameSource: (topicId, sourceId, name, signal) => request(`/topics/${encodeURIComponent(topicId)}/sources/${encodeURIComponent(sourceId)}`, { method: 'PATCH', body: JSON.stringify({ name }) }, signal),
  deleteSource: (topicId, sourceId, signal) => request(`/topics/${encodeURIComponent(topicId)}/sources/${encodeURIComponent(sourceId)}`, { method: 'DELETE' }, signal),
  deleteTopic: (id, signal) => request(`/topics/${encodeURIComponent(id)}`, { method: 'DELETE' }, signal),
  scopeTopic: (id, message, history, signal) => request(`/topics/${encodeURIComponent(id)}/scope`, { method: 'POST', body: JSON.stringify({ message, history }) }, signal),
  proposeTopicChanges: (id, messages, signal) => request(`/topics/${encodeURIComponent(id)}/conversation/propose`, { method: 'POST', body: JSON.stringify({ topicId: id, messages: messages.map((message) => ({ id: message.id, role: message.role, parts: [{ type: 'text', text: message.text }] })) }) }, signal, 90000),
  applyTopicChanges: (id, proposal, signal) => request(`/topics/${encodeURIComponent(id)}/conversation/apply`, { method: 'POST', body: JSON.stringify({ proposal }) }, signal),
  updateContext: (id, context, signal) => request(`/topics/${encodeURIComponent(id)}/context`, { method: 'PATCH', body: JSON.stringify(context) }, signal),
  submitAnswer: (input, signal) => request('/questions/answer', { method: 'POST', body: JSON.stringify(input) }, signal, 90000),
  recommendQuestion: (topicId, signal) => request(`/topics/${encodeURIComponent(topicId)}/recommendation`, { method: 'POST' }, signal, 240000),
  generateNodeQuestion: (topicId, nodeId, signal) => request(`/topics/${encodeURIComponent(topicId)}/nodes/${encodeURIComponent(nodeId)}/questions/generate`, { method: 'POST' }, signal, 240000),
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
