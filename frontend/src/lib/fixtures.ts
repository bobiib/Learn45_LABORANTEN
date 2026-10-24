import type { BloomEvidence, DashboardData, Topic, TopicNode } from './types'

const emptyEvidence = (): BloomEvidence => ({
  Remember: 0,
  Understand: 0,
  Apply: 0,
  Analyze: 0,
  Evaluate: 0,
  Create: 0,
})

const nodes: TopicNode[] = [
  { id: 'prompt-goal', label: 'Promptziel klären', description: 'Festlegen, wer die Zusammenfassung liest und was die Person danach tun soll.', prerequisites: [], progress: 62, eligible: true, evidence: { ...emptyEvidence(), Remember: 12, Understand: 24, Apply: 26 } },
  { id: 'prompt-context', label: 'Kontext auswählen', description: 'Die Hintergrundinformationen wählen, die der KI wirklich weiterhelfen.', prerequisites: [], progress: 38, eligible: true, evidence: { ...emptyEvidence(), Remember: 10, Understand: 28 } },
  { id: 'prompt-criteria', label: 'Qualitätskriterien festlegen', description: 'Beschreiben, was eine hilfreiche und überprüfbare Zusammenfassung enthalten muss.', prerequisites: ['prompt-goal', 'prompt-context'], progress: 18, eligible: true, evidence: { ...emptyEvidence(), Remember: 8, Understand: 10 } },
  { id: 'prompt-revise', label: 'Antwort am Ausgangstext prüfen', description: 'Die KI-Zusammenfassung mit den Notizen abgleichen und den Auftrag gezielt verbessern.', prerequisites: ['prompt-criteria'], progress: 0, eligible: true, evidence: emptyEvidence() },
  { id: 'prompt-transfer', label: 'Wissen auf neuen Fall übertragen', description: 'Dieselbe Prompt-Strategie auf ein anderes Projektbeispiel anwenden.', prerequisites: ['prompt-revise'], progress: 0, eligible: false, evidence: emptyEvidence() },
]

export const initialTopic: Topic = {
  id: 'clear-ai-prompts',
  title: 'Klare KI-Aufträge formulieren',
  subject: 'Berufliche Kompetenzen',
  description: 'Formuliere klare KI-Aufträge und prüfe Zusammenfassungen für dein Projektteam.',
  updatedLabel: 'Gestern fortgesetzt',
  progress: 42,
  sources: [
    { id: 'source-1', name: 'Project notes & meeting transcript.pdf', kind: 'PDF', sizeLabel: '2.4 MB', addedLabel: 'Added Oct 20' },
    { id: 'source-2', name: 'Prompting guidelines — lecture 04.pdf', kind: 'PDF', sizeLabel: '1.1 MB', addedLabel: 'Added Oct 20' },
  ],
  nodes,
  questions: [
    { id: 'q-goal', topicId: 'prompt-goal', title: 'Leser und Ziel bestimmen', prompt: 'Lea braucht eine Zusammenfassung ihrer Projektnotizen für die Teamleitung. Für wen soll sie schreiben und was soll die Person danach tun können?', stage: 'Understand', mode: 'Solo', duration: '4 min', status: 'recommended' },
    { id: 'q-context', topicId: 'prompt-context', title: 'Passenden Kontext auswählen', prompt: 'Welche zwei Angaben aus den Notizen helfen der KI am meisten, ohne jede Diskussion zu wiederholen?', stage: 'Remember', mode: 'Solo', duration: '3 min', status: 'up-next' },
    { id: 'q-criteria', topicId: 'prompt-criteria', title: 'Qualitätskriterien festlegen', prompt: 'Formuliere eine Anweisung, mit der Lea prüfen kann, ob Entscheidungen, verantwortliche Personen und nächste Schritte enthalten sind.', stage: 'Apply', mode: 'Solo', duration: '5 min', status: 'up-next' },
    { id: 'q-compare', topicId: 'prompt-criteria', title: 'Gemeinsam fehlende Zuständigkeiten entdecken', prompt: 'Die Zusammenfassung nennt Entscheidungen, aber nicht, wer die nächsten Schritte übernimmt. Wie würdet ihr den Auftrag so verbessern, dass diese Lücke auffällt?', stage: 'Analyze', mode: 'Partner', duration: '6 min', status: 'up-next' },
    { id: 'q-revise', topicId: 'prompt-revise', title: 'KI-Antwort am Quelltext prüfen', prompt: 'Lea hat ihren Auftrag selbst formuliert: höchstens fünf Stichpunkte, Aufgaben mit Namen und fehlende Fristen als offen markieren. Prüfe die Zusammenfassung an den Notizen: Stimmen Aussagen, Namen und offene Fristen? Was sollte Lea am Auftrag verbessern?', stage: 'Evaluate', mode: 'Solo', duration: '7 min', status: 'up-next' },
    { id: 'q-transfer', topicId: 'prompt-transfer', title: 'Prompt auf neuen Fall übertragen', prompt: 'Übertrage Leas Prompt-Strategie auf ein anderes Projektmeeting. Welche Angaben würdest du anpassen?', stage: 'Create', mode: 'Partner', duration: '8 min', status: 'up-next' },
  ],
  context: {
    examDate: '2026-11-02',
    timeAvailable: 'About 20 minutes a day',
    preferredLength: 'Short',
    tutorEnabled: true,
    focus: 'Prepare concise, actionable project updates',
  },
}

export const initialDashboard: DashboardData = {
  learnerName: 'Lea',
  streak: 4,
  studyMinutes: 85,
  weeklyGoalMinutes: 120,
  completedSessions: 12,
  topics: [initialTopic],
  lastSession: { topicId: initialTopic.id, title: 'Klare KI-Aufträge formulieren', detail: 'Qualitätskriterien festlegen', progress: 42 },
}

export const nodePositions = [
  { id: 'prompt-goal', position: { x: 40, y: 40 } },
  { id: 'prompt-context', position: { x: 40, y: 190 } },
  { id: 'prompt-criteria', position: { x: 310, y: 115 } },
  { id: 'prompt-revise', position: { x: 580, y: 115 } },
  { id: 'prompt-transfer', position: { x: 850, y: 115 } },
]

export const bloomStages = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const

export function createTopicFromFile(fileName: string): Topic {
  return {
    ...initialTopic,
    id: `topic-${Date.now()}`,
    title: fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
    subject: 'Neues Lernthema',
    description: 'Ein neuer Lernplan, abgestimmt auf Leas Ziel und ihre Notizen.',
    progress: 0,
    updatedLabel: 'Gerade hinzugefügt',
    sources: [{ id: `source-${Date.now()}`, name: fileName, kind: fileName.split('.').pop()?.toUpperCase() ?? 'FILE', sizeLabel: 'Ready to process', addedLabel: 'Just added' }],
    nodes: initialTopic.nodes.map((node) => ({ ...node, progress: 0, eligible: node.prerequisites.length === 0, evidence: emptyEvidence() })),
    questions: initialTopic.questions.map((question) => ({ ...question, status: 'up-next' as const })),
    context: { ...initialTopic.context },
  }
}

export function refreshEligibility(topic: Topic): Topic {
  const startedOrDone = new Set(topic.nodes.filter((node) => node.progress > 0).map((node) => node.id))
  return {
    ...topic,
    nodes: topic.nodes.map((node) => ({
      ...node,
      eligible: node.prerequisites.every((prerequisite) => startedOrDone.has(prerequisite)),
    })),
  }
}
