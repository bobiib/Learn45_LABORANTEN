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
    throw new ApiError('Dieses Lernthema wurde nicht gefunden.', 404)
  },
  async uploadSource(file, topicId, signal) {
    await pause(signal, 1050)
    if (topicId) {
      const topic = await this.getTopic(topicId, signal)
      const updated = { ...topic, sources: [...topic.sources, { id: `source-${Date.now()}`, name: file.name, kind: file.name.split('.').pop()?.toUpperCase() ?? 'DATEI', sizeLabel: 'Bereit zur Verarbeitung', addedLabel: 'Gerade hinzugefügt' }] }
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
    const asksToSplit = /\b(split|teilen|teile|aufteilen|unterteilen|in\s+zwei|in\s+2)\b/i.test(text)
    if (asksToSplit) {
      const normalized = text.toLowerCase()
      const target = topic.nodes.find((node) => normalized.includes(node.label.toLowerCase()))
        ?? topic.nodes.find((node) => /grading|assignment|benotung|aufgabe/i.test(node.label) && /grading|assignment|benotung|aufgabe/i.test(text))
      if (target && target.progress === 0) {
        const gradingAufgaben = /grading|assignment|benotung|aufgabe/i.test(`${target.label} ${text}`)
        const firstLabel = gradingAufgaben ? 'Bewertung' : `Teil 1: ${target.label}`
        const secondLabel = gradingAufgaben ? 'Aufgaben' : `Teil 2: ${target.label}`
        changes.nodes.push({ id: target.id, label: firstLabel, description: gradingAufgaben ? 'Bewertungskriterien, Notenfindung und Rückmeldungen verstehen.' : `Erster Teil von ${target.label}: Grundlagen und zentrale Begriffe verstehen.` })
        changes.addNodes.push({ key: 'split-follow-up', label: secondLabel, description: gradingAufgaben ? 'Aufgaben planen, bearbeiten und anhand der Bewertungskriterien prüfen.' : `Zweiter Teil von ${target.label}: Wissen anwenden und überprüfen.`, prerequisites: [target.id] })
      }
    }
    if (!Object.keys(changes.context).length && !changes.nodes.length && !changes.addNodes.length) changes.assistantMessage = `Ich kann „${topic.title}“ anpassen. Im Demo kannst du zum Beispiel schreiben: „Schwerpunkt auf Zellaufbau setzen“, „Lernzeit auf 30 Minuten pro Tag setzen“ oder einen Lernschritt in zwei Teile aufteilen.`
    else changes.assistantMessage = 'Hier ist der Änderungsvorschlag. Prüfe ihn und bestätige ihn, um ihn zu speichern.'
    return { assistantMessage: changes.assistantMessage, proposal: changes }
  },
  async applyTopicChanges(topicId, proposal, signal) {
    await pause(signal, 320)
    const topic = await this.getTopic(topicId, signal)
    if (proposal.deleteNodeIds.some((id) => (topic.nodes.find((node) => node.id === id)?.progress ?? 0) > 0)) throw new ApiError('Ein Lernschritt mit gespeichertem Fortschritt kann nicht gelöscht werden.', 409)
    if (topic.nodes.some((node) => !proposal.deleteNodeIds.includes(node.id) && node.prerequisites.some((id) => proposal.deleteNodeIds.includes(id)))) throw new ApiError('Ein Lernschritt, von dem andere Schritte abhängen, kann erst nach Anpassung dieser Schritte gelöscht werden.', 409)
    if (proposal.deleteQuestionIds.some((id) => topic.questions.find((question) => question.id === id)?.status === 'completed')) throw new ApiError('Eine Frage mit gespeicherten Übungsversuchen kann nicht gelöscht werden.', 409)
    const removedNodeQuestions = topic.questions.filter((question) => proposal.deleteNodeIds.includes(question.topicId)).map((question) => question.id)
    if (removedNodeQuestions.some((id) => !proposal.deleteQuestionIds.includes(id))) throw new ApiError('Beim Löschen eines Lernschritts müssen auch die dazugehörigen Übungsfragen gelöscht werden.', 422)
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
      if (!change) return question
      const { format, options, selectCount, ...fields } = change
      const hasActivityChange = !!(format || options || selectCount)
      return { ...question, ...Object.fromEntries(Object.entries(fields).filter(([key, value]) => key !== 'id' && key !== 'durationMinutes' && value !== undefined && value !== null)), ...(change.durationMinutes ? { duration: `${change.durationMinutes} min` } : {}), ...(hasActivityChange ? { questionType: format ?? question.questionType, content: { ...(question.content ?? {}), ...(format ? { format } : {}), ...(options ? { options } : {}), ...(selectCount ? { selectCount } : {}) } } : {}) }
    }).concat(proposal.addQuestions.map((question, index) => ({
      id: `question-demo-${Date.now()}-${index}`, topicId: addedNodeIds.get(question.nodeRef) ?? question.nodeRef,
      title: question.title, prompt: question.prompt, stage: question.stage, mode: question.mode, sources: question.sources,
      questionType: question.format, content: { format: question.format, options: question.options ?? [], selectCount: question.selectCount ?? 1 },
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
      headline: 'Ein klarer Anfang mit einem guten Ziel',
      feedback: 'Du hast eine konkrete Zielgruppe oder ein klares Ergebnis benannt. So weiss die KI, worauf es bei der Zusammenfassung ankommt. Prüfe als Nächstes, ob sich die Angaben mit den Notizen belegen lassen.',
      evidenceLabel: hintPenalty ? 'Starker Nachweis · mit Unterstützung' : 'Starker eigenständiger Nachweis',
      evidenceDelta: hintPenalty ? 8 : 14,
      nextActivity: 'Erfolgskriterien überprüfbar machen',
      nextReason: 'Dein Auftrag nennt eine klare Zielgruppe. Lege als Nächstes fest, welche Belege enthalten sein müssen, damit Lea die Zusammenfassung zuverlässig prüfen kann.',
      nextQuestionId: input.questionId === 'q-criteria' ? 'q-revise' : 'q-criteria',
    }
    else if (correctness === 'partial') result = {
      correctness,
      estimatedPointsPercent: hintPenalty ? 48 : 62,
      headline: 'Ein Teil des Auftrags steht schon',
      feedback: 'Ein hilfreicher Punkt ist schon enthalten. Ergänze noch die Zielgruppe, das gewünschte Ergebnis oder eine überprüfbare Vorgabe. Vergleiche dann den überarbeiteten Auftrag mit den Notizen.',
      evidenceLabel: hintPenalty ? 'Teilweiser Nachweis · mit Unterstützung' : 'Teilweiser eigenständiger Nachweis',
      evidenceDelta: hintPenalty ? 3 : 6,
      nextActivity: 'Ein konkretes Qualitätskriterium ergänzen',
      nextReason: 'Dein Versuch zeigt ein teilweises Verständnis. Eine weitere konkrete Vorgabe macht die nächste Übungsfrage passend.',
      nextQuestionId: 'q-criteria',
    }
    else result = {
      correctness,
      estimatedPointsPercent: 12,
      headline: 'Machen wir das Ziel konkreter',
      feedback: 'In deiner Antwort fehlen noch Zielgruppe, Ergebnis oder eine konkrete Vorgabe. Überlege, wer die Zusammenfassung nutzt und was die Person damit tun soll. Versuche es mit etwas mehr Genauigkeit noch einmal.',
      evidenceLabel: 'Versuch gespeichert · Fortschritt unverändert',
      evidenceDelta: 0,
      nextActivity: 'Mit einer kürzeren Frage zur Zielgruppe starten',
      nextReason: 'Die Zielgruppe ist noch nicht ganz klar. Ein kleinerer Schritt hilft, bevor du zum vollständigen Auftrag zurückkehrst.',
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
    const nodeRank = new Map(orderedNodes.map((node, index) => [node.id, index]))
    const candidate = topic.questions
      .filter((question) => eligible.some((node) => node.id === question.topicId) && !history(question.id).length)
      .filter((question) => {
        const node = eligible.find((item) => item.id === question.topicId)!
        return !(node.progress >= 100 && weaknesses(node.id) < .35)
      })
      .sort((a, b) => Number(b.stage === 'Apply') - Number(a.stage === 'Apply') || nodeRank.get(a.topicId)! - nodeRank.get(b.topicId)!)[0]
    if (candidate) {
      const node = eligible.find((item) => item.id === candidate.topicId)!
      return { question: candidate, reason: weaknesses(node.id) > 1 ? `Deine letzten Übungen zeigen, dass ein weiterer Schritt zu „${node.label}“ hilfreich wäre.` : `Übe „${node.label}“, bevor du zum nächsten Thema gehst.`, generated: false }
    }
    const node = orderedNodes.find((item) => weaknesses(item.id) >= .35 && topic.questions.some((question) => question.topicId === item.id))
    if (!node) return { question: null, reason: 'Du hast die verfügbaren Fragen bearbeitet. Im Moment braucht kein offener Lernschritt eine weitere Übungsfrage.', generated: false }
    const stage = topic.questions.find((question) => question.topicId === node.id)?.stage ?? 'Understand'
    const generated = {
      id: `question-demo-${Date.now()}`, topicId: node.id,
      title: `Neue Übung: ${node.label}`, prompt: `Erkläre anhand eines konkreten Beispiels die wichtigsten Gedanken zu „${node.label}“. Was würdest du tun und warum?`,
      stage: 'Apply', mode: 'Solo' as const, duration: '5 min', status: 'recommended' as const,
    }
    const updated = { ...topic, questions: [...topic.questions, generated] }
    saveStoredTopic(updated)
    return { question: generated, reason: `Dein Fortschritt zeigt, dass du „${node.label}“ noch an einem Beispiel üben kannst. Ich habe eine neue Frage ergänzt.`, generated: true }
  },
  async generateNodeQuestion(topicId, nodeId, signal) {
    await pause(signal, 900)
    const topic = await this.getTopic(topicId, signal)
    const node = topic.nodes.find((item) => item.id === nodeId)
    if (!node) throw new ApiError('Dieser Lernschritt wurde nicht gefunden.', 404)
    const generated: LearningQuestion = {
      id: `question-demo-${Date.now()}`, topicId: node.id,
      title: `Übung: ${node.label}`, prompt: `Erkläre anhand eines konkreten Beispiels die wichtigsten Gedanken zu „${node.label}“. Was würdest du tun und warum?`,
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
        ? 'Denk an die Person, die die Zusammenfassung liest. Welche Entscheidung oder Handlung soll ihr danach möglich sein?'
        : /include|criteria|check/i.test(message)
          ? 'Nenne zwei Angaben, die die Zusammenfassung nützlich und überprüfbar machen, etwa Entscheidungen und Zuständigkeiten.'
          : 'Was weisst du bereits über die Zielgruppe und den Zweck der Zusammenfassung? Beginne damit und ergänze eine Angabe, die sich anhand der Notizen prüfen lässt.',
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
    if (timeout.signal.aborted && timeout.signal.reason?.name === 'TimeoutError') throw new ApiError('Der Server hat zu lange gebraucht. Bitte versuche es erneut.')
    throw new ApiError('Der Lerndienst ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.')
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
