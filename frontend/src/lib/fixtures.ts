import type { BloomEvidence, BloomStage, DashboardData, LearningQuestion, Topic, TopicNode } from './types'

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
    { id: 'source-1', name: 'Projektunterlagen und Sitzungsprotokoll.pdf', kind: 'PDF', sizeLabel: '2.4 MB', addedLabel: 'Hinzugefügt am 20. Okt.' },
    { id: 'source-2', name: 'Leitfaden für KI-Aufträge — Vorlesung 04.pdf', kind: 'PDF', sizeLabel: '1.1 MB', addedLabel: 'Hinzugefügt am 20. Okt.' },
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
    timeAvailable: 'Etwa 20 Minuten pro Tag',
    preferredLength: 'Short',
    tutorEnabled: true,
    focus: 'Kurze, umsetzbare Projekt-Updates formulieren',
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
function slugify(value: string, index: number): string {
  const base = value.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 28)
  return base ? `lernschritt-${base}-${index}` : `lernschritt-${index}`
}

function cleanFocusItems(message: string): string[] {
  const cleaned = message
    .replace(/^(?:bitte\s+)?(?:(?:ich\s+)?(?:möchte|will|würde gern(?:e)?)|fokus(?:siere)? auf|konzentriere mich auf|ich möchte mich auf|please|i want to|focus on|only)\s+/i, '')
    .replace(/\s+(?:lernen|üben|anschauen|verstehen|anwenden|konzentrieren|study|practice|learn)\.?$/i, '')
    .trim()
  return cleaned
    .split(/\s*(?:,|;|\/|\bund\b|\bsowie\b|\bplus\b|\n)\s*/i)
    .map((item) => item.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((item) => item.length >= 2 && item.length <= 55)
}

function makeQuestionsForNodes(nodes: TopicNode[], sourceTitle: string): LearningQuestion[] {
  const stages: BloomStage[] = ['Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']
  return nodes.map((node, index) => ({
    id: `frage-${node.id}-1`,
    topicId: node.id,
    title: `Übung: ${node.label}`,
    prompt: `Nutze dein Lernmaterial „${sourceTitle}“, um „${node.label}“ zu erklären oder an einem konkreten Beispiel anzuwenden. Welche Information hilft dir dabei?`,
    stage: stages[index % stages.length],
    mode: 'Solo',
    duration: `${4 + Math.min(index, 3)} Min.`,
    status: index === 0 ? 'recommended' : 'up-next',
  }))
}

export function buildScopedPlanFromMessage(topic: Topic, message: string): { topic: Topic; assistantMessage: string } {
  const trimmed = message.trim()
  if (!trimmed) return { topic, assistantMessage: 'Sag mir, auf welche Inhalte du dich konzentrieren möchtest.' }
  const sourceTitle = topic.sources[0]?.name.replace(/\.[^.]+$/, '') ?? topic.title
  const isAddRequest = /\b(?:füg(?:e|t)?|ergänz(?:e|t)?|hinzu|neue[rs]?\s+(?:frage|abschnitt|thema|lernschritt)|erstelle|anlegen|add|create)\b/i.test(trimmed)

  if (isAddRequest) {
    const rawLabel = trimmed
      .replace(/^(?:bitte\s+)?(?:füge|ergänze|erstelle|lege|add|create)\s+(?:bitte\s+)?(?:(?:einen?|eine|ein)\s+)?(?:(?:neuen?|neue|neues)\s+)?(?:(?:abschnitt|thema|lernschritt|frage)\s+)?/i, '')
      .replace(/\s+(?:hinzu|dazu|anlegen|erstellen|bitte)\.?$/i, '')
      .replace(/^(?:zum thema|zum punkt|über|zu)\s+/i, '')
      .trim()
    const label = (rawLabel || trimmed).slice(0, 38)
    const node: TopicNode = {
      id: slugify(label, topic.nodes.length + 1),
      label: label.charAt(0).toLocaleUpperCase('de-CH') + label.slice(1),
      description: `Zusätzlicher Lernschritt zu „${label}“ anhand von ${sourceTitle}.`,
      prerequisites: [],
      progress: 0,
      eligible: true,
      evidence: emptyEvidence(),
    }
    const question = makeQuestionsForNodes([node], sourceTitle)[0]
    const updatedTopic = refreshEligibility({
      ...topic,
      updatedLabel: 'Gerade angepasst',
      nodes: [...topic.nodes, node],
      questions: [...topic.questions, question],
    })
    return { topic: updatedTopic, assistantMessage: `Ich habe „${node.label}“ als neuen Lernschritt mit einer passenden Übung ergänzt. Du kannst den Abschnitt jetzt direkt öffnen.` }
  }

  const items = cleanFocusItems(trimmed)
  const focus = items[0] ?? trimmed.slice(0, 40)
  const labels = items.length >= 2
    ? items.slice(0, 5)
    : [`Grundlagen: ${focus}`, `Kriterien: ${focus}`, `Anwenden: ${focus}`, `Prüfen und übertragen: ${focus}`]
  const generatedNodes: TopicNode[] = labels.map((label, index) => ({
    id: slugify(label, index + 1),
    label: label.length > 38 ? `${label.slice(0, 36)}…` : label,
    description: `Übe „${label}“ mit Beispielen aus ${sourceTitle}.`,
    prerequisites: index < 2 ? [] : index === 2 ? [slugify(labels[0], 1), ...(labels.length >= 3 ? [slugify(labels[1], 2)] : [])] : [slugify(labels[index - 1], index)],
    progress: 0,
    eligible: index < 2,
    evidence: emptyEvidence(),
  }))
  const updatedTopic = refreshEligibility({
    ...topic,
    description: `Dein Lernpfad ist auf diesen Schwerpunkt ausgerichtet: ${trimmed}`,
    updatedLabel: 'Gerade angepasst',
    nodes: generatedNodes,
    questions: makeQuestionsForNodes(generatedNodes, sourceTitle),
    context: { ...topic.context, focus: trimmed.slice(0, 90) },
  })
  const names = generatedNodes.map((node) => `„${node.label}“`).join(', ')
  return {
    topic: updatedTopic,
    assistantMessage: `Ich habe deinen Lernpfad auf ${names} ausgerichtet und passende Übungen erstellt. Du kannst einen Lernschritt auswählen und direkt allein starten.`,
  }
}

export function createTopicFromFile(fileName: string): Topic {
  const cleanTitle = fileName.replace(/\.[^.]+$/, '').replace(/\(\d+\)\s*$/, '').replace(/[_-]+/g, ' ').trim() || 'Neues Lernthema'
  const generatedNodes: TopicNode[] = [
    { id: 'doc-foundations', label: 'Grundlagen und Lernziel', description: `Zentrale Begriffe und das Lernziel aus „${cleanTitle}“ verstehen.`, prerequisites: [], progress: 0, eligible: true, evidence: emptyEvidence() },
    { id: 'doc-context', label: 'Wichtige Anforderungen', description: `Die wichtigsten Bedingungen und Angaben aus „${cleanTitle}“ erkennen.`, prerequisites: [], progress: 0, eligible: true, evidence: emptyEvidence() },
    { id: 'doc-criteria', label: 'Qualitätskriterien anwenden', description: `Prüfbare Kriterien aus „${cleanTitle}“ auf einen Fall anwenden.`, prerequisites: ['doc-foundations', 'doc-context'], progress: 0, eligible: false, evidence: emptyEvidence() },
    { id: 'doc-transfer', label: 'In die Praxis übertragen', description: `Ein realistisches Beispiel zu „${cleanTitle}“ lösen und das Ergebnis prüfen.`, prerequisites: ['doc-criteria'], progress: 0, eligible: false, evidence: emptyEvidence() },
  ]
  return {
    ...initialTopic,
    id: `topic-${Date.now()}`,
    title: cleanTitle,
    subject: 'Neues Lernthema',
    description: `Ein Lernpfad zum Üben und Anwenden der Inhalte aus „${cleanTitle}“.`,
    progress: 0,
    updatedLabel: 'Gerade hinzugefügt',
    sources: [{ id: `source-${Date.now()}`, name: fileName, kind: fileName.split('.').pop()?.toUpperCase() ?? 'DATEI', sizeLabel: 'Für die Demo bereit', addedLabel: 'Gerade hinzugefügt' }],
    nodes: generatedNodes,
    questions: makeQuestionsForNodes(generatedNodes, cleanTitle),
    context: { ...initialTopic.context, focus: `Zentrale Inhalte aus „${cleanTitle}“ verstehen` },
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
