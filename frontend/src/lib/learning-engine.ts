import { activityTime } from './learning-content.ts'
import type { AnswerSubmission, BloomStage, LearningActivity, LearningMode, LearningQuestion, PracticeAttempt, ReviewResult } from './learning-types'

export const bloomLabels: Record<BloomStage, string> = {
  Remember: 'Erinnern', Understand: 'Verstehen', Apply: 'Anwenden',
  Analyze: 'Analysieren', Evaluate: 'Beurteilen', Create: 'Gestalten',
}

const notes = {
  title: 'Aus der Projektsitzung',
  text: 'Nora überarbeitet die Dokumentation. Eine Frist wurde nicht vereinbart. Malik prüft die Kosten bis Dienstag. Die Budgetfreigabe steht noch aus.',
  source: 'Übungsmaterial · Projektnotizen',
}
const criteria = [
  { id: 'audience', label: 'Zielgruppe benennen', explanation: 'Für wen ist die Zusammenfassung bestimmt?', pattern: 'projektleit|leser|zielgruppe|vorgesetzt' },
  { id: 'format', label: 'Umfang überprüfbar machen', explanation: 'Eine konkrete Länge oder ein klares Format macht das Ergebnis überprüfbar.', pattern: '(\\d+|drei|vier|fünf|sechs|maximal|höchstens).{0,24}(stichpunkt|punkt|wort|satz|sätz)|tabelle' },
  { id: 'owners', label: 'Aufgaben und Zuständigkeiten verbinden', explanation: 'Eine Aufgabe wird erst mit einer verantwortlichen Person umsetzbar.', pattern: 'zuständig|verantwort|übernimmt|zuordn|aufgaben.{0,35}(name|person)|wer.{0,20}(aufgabe|übernimmt)' },
  { id: 'uncertainty', label: 'Fehlende Angaben kenntlich machen', explanation: 'Nicht vereinbarte Fristen bleiben offen; die KI soll sie nicht ergänzen.', pattern: 'offen|fehlend|nicht vereinbart|nicht erfind|nicht ergänz|unbekannt' },
]

const promptingHints = [
  'Stell dir vor, du prüfst später die KI-Antwort: Welche Vorgabe könntest du eindeutig abhaken?',
  '«Kurz» hängt von der Person ab. Eine Anzahl oder ein Format gibt beiden Seiten denselben Massstab. Welche Vorgabe passt zu diesem Update?',
  'In einem anderen Fall: «Schreibe freundlich» ist offen. «Begrüsse die Kundin mit Namen und nenne einen nächsten Schritt» lässt sich prüfen. Übertrage dieses Prinzip auf die Projektnotizen.',
]

export const practiceActivities: LearningActivity[] = [
  {
    id: 'q-goal', skillId: 'prompt-goal', stage: 'Understand', format: 'choose', minutes: 2,
    title: 'Was braucht die Projektleitung?',
    prompt: 'Welche Anweisung hilft Lea am meisten? Wähle einen Auftrag und begründe deine Entscheidung in einem Satz.',
    rationale: 'Du verbindest die lesende Person mit dem Zweck des Updates. Das ist die Grundlage für einen klaren Auftrag.',
    scenario: notes, selectCount: 1,
    options: [
      { id: 'polished', text: 'Fasse die Sitzung gut und professionell zusammen.', correct: false, explanation: '«Gut» und «professionell» lassen offen, was die Projektleitung erfahren soll.' },
      { id: 'actionable', text: 'Erstelle für die Projektleitung ein Update zu offenen Aufgaben, Verantwortlichen und ausstehenden Entscheidungen.', correct: true, explanation: 'Der Auftrag nennt eine lesende Person und einen konkreten Verwendungszweck.' },
      { id: 'everything', text: 'Schreibe alle Aussagen der Sitzung in derselben Reihenfolge auf.', correct: false, explanation: 'Die Reihenfolge allein hilft der Projektleitung nicht bei den nächsten Entscheidungen.' },
    ],
    criteria: [{ id: 'purpose', label: 'Den Nutzen für die lesende Person erklären', explanation: 'Erkläre, was die Projektleitung mit diesem Update tun kann.', pattern: 'entscheidung|aufgabe|weiter|überblick|verantwort|handeln|nächst' }],
    hints: ['Welche Information braucht die Projektleitung, um weiterarbeiten zu können?', ...promptingHints.slice(0, 2)],
  },
  {
    id: 'q-context', skillId: 'prompt-context', stage: 'Remember', format: 'choose', minutes: 2,
    title: 'Welche Angaben zählen?', prompt: 'Wähle die zwei Angaben, die in einem handlungsorientierten Update nicht fehlen dürfen.',
    rationale: 'Du unterscheidest relevante Informationen von Ausschmückungen, bevor du einen eigenen Auftrag formulierst.',
    scenario: notes, selectCount: 2,
    options: [
      { id: 'owner', text: 'Wer eine offene Aufgabe übernimmt.', correct: true, explanation: 'Die Zuständigkeit macht eine Aufgabe umsetzbar.' },
      { id: 'style', text: 'Ob das Meeting besonders angenehm war.', correct: false, explanation: 'Diese Information ändert die nächsten Arbeitsschritte nicht.' },
      { id: 'deadline', text: 'Welche Frist vereinbart wurde oder noch offen ist.', correct: true, explanation: 'Vereinbarte und fehlende Fristen müssen auseinandergehalten werden.' },
      { id: 'order', text: 'In welcher Reihenfolge alle Personen gesprochen haben.', correct: false, explanation: 'Die Reihenfolge ist für dieses Update nachrangig.' },
    ], criteria: [], hints: ['Was müsste jemand wissen, um eine Aufgabe tatsächlich zu übernehmen?', ...promptingHints.slice(0, 2)],
  },
  {
    id: 'q-criteria', skillId: 'prompt-criteria', stage: 'Apply', format: 'write', minutes: 4,
    title: 'Aus «gut» wird überprüfbar.',
    prompt: 'Leas bisheriger Auftrag lautet: «Fasse die Notizen kurz und professionell zusammen.» Formuliere ihn so um, dass Lea das Ergebnis anschliessend überprüfen kann.',
    rationale: 'Du übst, vage Wünsche in überprüfbare Vorgaben zu übersetzen. Der Fokus liegt heute auf Umfang, Zuständigkeiten und offenen Angaben.',
    scenario: notes, criteria, hints: promptingHints,
  },
  {
    id: 'q-compare', skillId: 'prompt-criteria', stage: 'Analyze', format: 'spot', minutes: 3,
    title: 'Was hat die KI dazuerfunden?', prompt: 'Markiere die zwei Aussagen, die durch die Projektnotizen nicht gedeckt sind. Begründe kurz, woran du sie erkennst.',
    rationale: 'Du prüfst ein Ergebnis an seiner Quelle und trennst belegte Angaben von Annahmen.',
    scenario: notes, selectCount: 2,
    options: [
      { id: 'invented-deadline', text: 'Nora liefert die Dokumentation bis Freitag.', correct: true, explanation: 'Für Nora wurde keine Frist vereinbart.' },
      { id: 'real-deadline', text: 'Malik prüft die Kosten bis Dienstag.', correct: false, explanation: 'Das steht ausdrücklich in den Notizen.' },
      { id: 'invented-budget', text: 'Das Budget ist bereits freigegeben.', correct: true, explanation: 'Die Freigabe steht laut Quelle noch aus.' },
    ], criteria: [{ id: 'evidence', label: 'Mit der Quelle begründen', explanation: 'Beziehe deine Begründung auf eine fehlende Frist oder die ausstehende Freigabe.', pattern: 'frist|freitag|freigabe|budget|offen|notiz|quelle' }],
    hints: ['Vergleiche jede Aussage mit genau der Stelle in der Quelle, die sie belegen müsste.', 'Achte besonders auf Zeitangaben und den Status von Entscheidungen.', 'Ein nicht vereinbarter Termin darf nicht plötzlich feststehen. Welche andere Aussage macht aus etwas Offenem eine Tatsache?'],
  },
  {
    id: 'q-revise', skillId: 'prompt-revise', stage: 'Evaluate', format: 'choose', minutes: 3,
    title: 'Welcher Prompt hält stand?', prompt: 'Beurteile die beiden Aufträge. Welcher lässt sich zuverlässiger prüfen? Nenne das entscheidende Kriterium.',
    rationale: 'Du bewertest anhand von Kriterien und begründest dein Urteil, statt nur die besser klingende Formulierung zu wählen.',
    scenario: notes, selectCount: 1,
    options: [
      { id: 'vague', text: 'Schreibe einen überzeugenden und vollständigen Projektbericht.', correct: false, explanation: 'Die Begriffe «überzeugend» und «vollständig» sind hier nicht definiert.' },
      { id: 'specific', text: 'Erstelle höchstens fünf Stichpunkte für die Projektleitung. Nenne Aufgaben mit Verantwortlichen und kennzeichne fehlende Fristen als offen.', correct: true, explanation: 'Umfang, Inhalt und Umgang mit fehlenden Angaben sind überprüfbar.' },
    ], criteria: [{ id: 'judgment', label: 'Urteil an einem Kriterium festmachen', explanation: 'Nenne eine überprüfbare Vorgabe und erkläre ihren Nutzen.', pattern: 'stichpunkt|umfang|frist|verantwort|prüf|konkret|offen' }], hints: promptingHints,
  },
  {
    id: 'q-transfer', skillId: 'prompt-transfer', stage: 'Create', format: 'artifact', minutes: 5,
    title: 'Dein Prompt für den nächsten Einsatz.', prompt: 'Entwickle eine wiederverwendbare Prompt-Vorlage für Sitzungsnotizen. Lade sie als Datei hoch oder schreibe sie direkt. Ergänze, wie du die Vorlage prüfen würdest.',
    rationale: 'Du überträgst die Kriterien auf ein eigenes Arbeitsmittel. Das Ergebnis kannst du später wiederverwenden.',
    scenario: { ...notes, title: 'Ein neuer Kontext', text: 'Die nächste Sitzung betrifft einen Kundenworkshop: Aylin erstellt ein Angebot. Der Preis ist noch offen. Jonas klärt bis Donnerstag die technischen Anforderungen.' },
    criteria, hints: promptingHints, accept: '.txt,.md,.pdf,.docx', fileLabel: 'TXT, Markdown, PDF oder DOCX · bis 5 MB', transfer: true,
  },
  {
    id: 'q-python-create', skillId: 'python-game', stage: 'Create', format: 'artifact', minutes: 10,
    title: 'Ein kleines Spiel. Deine Regeln.', prompt: 'Entwickle Tic-Tac-Toe für zwei Personen im Python-Terminal. Lade deinen Code hoch und beschreibe einen Test für einen Sieg und einen für ein Unentschieden.',
    rationale: 'Du führst Zustandsverwaltung, Eingabeprüfung und Bedingungen in einem eigenen Programm zusammen.',
    scenario: { title: 'Dein Bauauftrag', text: 'Ein 3×3-Spielfeld. X und O ziehen abwechselnd. Belegte Felder werden abgewiesen. Das Spiel erkennt einen Sieg oder ein Unentschieden und endet dann.', source: 'Python-Werkstatt · Projektauftrag' },
    criteria: [
      { id: 'board', label: 'Spielfeld und Spielzustand', explanation: 'Der Code braucht ein Spielfeld und einen veränderbaren Spielzustand.', pattern: 'board|spielfeld|feld|brett' },
      { id: 'input', label: 'Eingaben prüfen', explanation: 'Prüfe ungültige Eingaben und bereits belegte Felder.', pattern: 'input\\s*\\(|eingabe' },
      { id: 'turn', label: 'Abwechselnde Züge', explanation: 'Beide Personen müssen abwechselnd einen Zug ausführen.', pattern: 'spieler|player|turn|current|wechsel' },
      { id: 'win', label: 'Sieg erkennen', explanation: 'Ein Sieg braucht eine eigene Prüfung für Zeilen, Spalten und Diagonalen.', pattern: 'win|sieg|gewinn|winner' },
      { id: 'draw', label: 'Unentschieden erkennen', explanation: 'Ein volles Feld ohne Sieg ist ein anderer Endzustand.', pattern: 'draw|unentschieden|tie|volles feld|vollen feld|full' },
    ],
    hints: ['Welche Informationen müssen sich nach jedem Zug ändern? Skizziere zuerst nur den Spielzustand.', 'Trenne die Aufgaben: Zug einlesen, Feld prüfen, Zustand ändern, Spielende prüfen. Welche davon kannst du einzeln testen?', 'Teste eine einzelne Siegprüfung mit einem vorbereiteten Spielfeld, bevor du sie in die Spielschleife einbaust. Dasselbe funktioniert für ein volles Feld ohne Sieger.'],
    accept: '.py,.txt,.zip', fileLabel: 'Python, TXT oder ZIP · bis 5 MB', transfer: true,
  },
]

export function activityForQuestion(question: LearningQuestion): LearningActivity {
  const known = practiceActivities.find((item) => item.id === question.id)
  if (known) return { ...known }
  return {
    id: question.id, skillId: question.topicId, title: question.title, prompt: question.prompt,
    stage: question.stage, minutes: parseInt(question.duration, 10) || 4, format: question.stage === 'Create' ? 'artifact' : 'write',
    rationale: 'Diese Aufgabe vertieft dein aktuelles Lernziel.',
    scenario: { title: 'Dein Lernmaterial', text: 'Beziehe dich bei deiner Antwort auf das Material in deinem Themenraum.', source: 'Eigene Unterlagen' },
    criteria: [], hints: ['Was soll deine Antwort zeigen?', 'Teile die Aufgabe in einen ersten kleinen Schritt.', 'Welche Stelle in deinem Lernmaterial hilft beim ersten Schritt?'], accept: '.txt,.md,.pdf,.docx,.py,.zip', fileLabel: 'Text, Dokument oder Code · bis 5 MB',
  }
}

/** Include actual theory, both partners' attempts, and closure before reducing scope. */
export function fitActivityToBudget(activity: LearningActivity, budget: number, mode: LearningMode = 'solo'): LearningActivity {
  if (activityTime(activity, mode) <= budget) return activity
  const minutes = mode === 'together' ? 1 : 2
  if (activity.skillId === 'prompt-criteria' && activity.format === 'write') return {
    ...activity, minutes, prompt: 'Überarbeite nur die Vorgabe «kurz»: Lege einen konkreten Umfang für das Projektupdate fest.',
    criteria: activity.criteria.filter((criterion) => criterion.id === 'format'),
    rationale: 'In dieser kurzen Einheit konzentrierst du dich auf ein überprüfbares Kriterium.',
  }
  return {
    ...activity, id: activity.id.startsWith('plan-') ? activity.id : `plan-${activity.id}`, minutes, stage: 'Understand', format: 'write', options: undefined, selectCount: undefined,
    title: 'Dein erster Projektbaustein.', prompt: `Plane einen ersten kleinen Schritt zu «${activity.title}». Beschreibe, welche Regel du brauchst und woran du den Erfolg dieses Schritts prüfen würdest.`,
    criteria: [], rationale: 'Dein Zeitrahmen reicht für einen kleinen Projektplan. Die Umsetzung folgt in einer längeren Einheit.',
  }
}

export function evaluatePractice(input: AnswerSubmission): ReviewResult {
  const activity = input.activity ?? practiceActivities.find((item) => item.id === input.questionId)
  if (!activity) return { correctness: 'partial', headline: 'Dein Versuch ist festgehalten.', feedback: 'Für dieses Lernmaterial ist noch keine automatische Auswertung verbunden.', evidenceLabel: 'Auswertung ausstehend', evidenceDelta: 0, nextActivity: 'Antwort gemeinsam prüfen', nextReason: 'Die fachliche Prüfung braucht eine passende Bewertungsgrundlage.', nextQuestionId: input.questionId, assessmentPending: true }
  const fileExtension = input.attachment?.name.split('.').pop()?.toLowerCase()
  const pending = !!input.attachment && !['txt', 'md', 'py'].includes(fileExtension ?? '') || !activity.criteria.length && !activity.options?.length
  const text = `${input.answer}\n${input.attachmentText ?? ''}`.toLowerCase()
  const criterionResults = activity.criteria.map((criterion) => ({
    id: criterion.id, label: criterion.label, met: !!criterion.pattern && new RegExp(criterion.pattern, 'i').test(text), explanation: criterion.explanation,
  }))
  const optionResults = activity.options?.map((option) => ({ id: option.id, label: option.text, met: !!input.selectedOptions?.includes(option.id) === option.correct, explanation: option.explanation })) ?? []
  const checks = [...optionResults, ...criterionResults]
  const score = checks.length ? checks.filter((item) => item.met).length / checks.length : 0
  // Local demo checks are deliberately transparent. They do not execute code or certify mastery.
  const codeTask = activity.id.startsWith('q-python')
  const correctness = pending || codeTask ? 'partial' : score >= .8 ? 'strong' : score >= .4 ? 'partial' : 'incorrect'
  const nextGap = checks.find((item) => !item.met)
  return {
    correctness,
    headline: pending ? 'Deine Arbeit ist bereit zur Prüfung.' : codeTask ? 'Dein Projekt ist angekommen.' : correctness === 'strong' ? 'Das ist ein klarer Schritt nach vorn.' : correctness === 'partial' ? 'Eine gute Grundlage. Ein Detail fehlt noch.' : 'Wir machen den nächsten Schritt kleiner.',
    feedback: pending ? 'Die Datei ist für diese Sitzung ausgewählt. Eine fachliche Auswertung dieses Dateiformats braucht die Backend-Anbindung.' : codeTask ? 'Die Demo kann nach Strukturelementen im Quelltext suchen. Ob das Spiel korrekt läuft, muss eine isolierte Code-Prüfung im Backend feststellen.' : correctness === 'strong' ? 'Die Kriterien dieser Übung sind im Demo-Check erkennbar. Ein neuer Kontext zeigt jetzt, ob du das Prinzip selbstständig übertragen kannst.' : nextGap?.explanation ?? 'Lass uns den Gedanken an einem kleineren Beispiel noch einmal ausprobieren.',
    evidenceLabel: input.learningMode === 'together' ? 'Gemeinsam erarbeitet' : input.supportUsed || input.hintsUsed > 0 || input.tutorUsed || input.theoryUsed ? 'Mit Unterstützung erarbeitet' : 'Selbstständig bearbeitet',
    evidenceDelta: pending || codeTask ? 0 : correctness === 'strong' ? 10 : correctness === 'partial' ? 4 : 0,
    nextActivity: correctness === 'strong' ? 'Das Prinzip neu anwenden' : 'Ein Kriterium gezielt üben',
    nextReason: correctness === 'strong' ? 'Eine neue Situation prüft den Transfer.' : nextGap?.explanation ?? 'Ein kleinerer Schritt hilft beim Weiterdenken.',
    nextQuestionId: correctness === 'strong' ? 'q-transfer' : 'q-criteria',
    criteria: pending ? undefined : checks, assessmentPending: pending || codeTask,
  }
}

export function nextActivity(current: LearningActivity, review: ReviewResult, attempts: PracticeAttempt[], difficulty: AnswerSubmission['difficulty']): LearningActivity {
  const strong = review.correctness === 'strong' && difficulty !== 'too-hard'
  const comparable = attempts.filter((item) => item.skillId === current.skillId && item.stage === current.stage && !item.supported && item.mode !== 'together').slice(-8)
  const successRate = comparable.length ? comparable.filter((item) => item.correctness === 'strong').length / comparable.length : 0
  const last = attempts.at(-1)
  if (strong) {
    const verifyIndependently = last?.supported || last?.mode === 'together'
    const stayAtLevel = verifyIndependently || comparable.length >= 5 && successRate <= .9 && difficulty !== 'too-easy'
    const next = stayAtLevel ? current : current.stage === 'Remember' || current.stage === 'Understand'
      ? practiceActivities.find((item) => item.id === 'q-criteria')!
      : current.stage === 'Apply' ? practiceActivities.find((item) => item.id === 'q-compare')!
        : practiceActivities.find((item) => item.id === 'q-transfer')!
    // Keep source-dependent statements aligned when varying the case.
    const scenario = next.format === 'spot' ? next.scenario : { ...notes, title: attempts.length % 2 ? 'Ein neuer Fall: Kundenworkshop' : 'Ein neuer Fall: Produkteinführung', text: attempts.length % 2 ? 'Aylin erstellt ein Angebot für den Kundenworkshop. Der Preis ist noch offen. Jonas klärt bis Donnerstag die technischen Anforderungen. Die Kundin hat noch nicht zugesagt.' : 'Lina verfasst die Produktbeschreibung. Ein Termin wurde noch nicht festgelegt. Amir testet bis Mittwoch den Prototyp. Die Freigabe für den Start steht aus.' }
    return { ...next, id: `${next.id}-transfer-${attempts.length}`, skillId: stayAtLevel ? current.skillId : next.skillId, transfer: true, scenario, rationale: verifyIndependently ? 'Nach der Unterstützung oder dem Austausch folgt ein neuer eigener Versuch auf derselben Denkstufe.' : stayAtLevel ? 'Deine bisherigen eigenen Versuche sprechen dafür, diese Denkstufe mit einer weiteren Variation zu festigen.' : 'Du hast den letzten Schritt bewältigt. Ein neuer Kontext prüft, ob du das Prinzip ohne Hilfe anwenden kannst.' }
  }
  if (current.id.startsWith('q-python')) return { ...current, id: `q-python-retry-${attempts.length}`, title: 'Ein Spielzustand nach dem anderen.', minutes: 5, prompt: 'Überarbeite zuerst nur die Prüfung des Spielendes. Lade deinen Zwischenstand hoch und erkläre die beiden Testfälle.', rationale: 'Du isolierst einen Teil deines Programms, bevor du das ganze Spiel erneut prüfst.' }
  const repeatCount = attempts.filter((item) => item.skillId === current.skillId && item.correctness !== 'strong').length
  return {
    ...practiceActivities[0], id: `scaffold-${current.skillId}-${attempts.length}`, skillId: current.skillId,
    title: 'Ein Kriterium. Ganz konkret.', stage: 'Understand', minutes: 2,
    prompt: 'Welche Vorgabe lässt sich eindeutig überprüfen? Wähle sie aus und erkläre kurz den Unterschied.',
    options: [
      { id: 'vague', text: 'Schreibe möglichst kurz und professionell.', correct: false, explanation: 'Die Begriffe lassen viel Interpretationsspielraum.' },
      { id: 'specific', text: 'Schreibe höchstens fünf Stichpunkte und kennzeichne fehlende Fristen als offen.', correct: true, explanation: 'Anzahl und Umgang mit fehlenden Angaben lassen sich direkt prüfen.' },
    ],
    criteria: [{ id: 'reason', label: 'Den Unterschied erklären', explanation: 'Warum lässt sich eine feste Vorgabe leichter überprüfen?', pattern: 'prüf|konkret|anzahl|fünf|genau|messbar|klar|offen|eindeutig' }],
    rationale: repeatCount >= 2 ? 'In mehreren Versuchen bleibt die Überprüfbarkeit unklar. Ein kurzes Coaching und ein kleineres Beispiel helfen beim nächsten eigenen Versuch.' : 'Wir greifen ein einzelnes Kriterium heraus. Danach wendest du es wieder selbst an.',
  }
}

export function coachReply(activity: LearningActivity, message: string, hintLevel: number, review?: ReviewResult | null) {
  if (/lösung|lösen|fertig|antwort.*(geben|schreib)|code.*(schreib|gib)/i.test(message)) return 'Ich begleite dich Schritt für Schritt. Welchen Teil kannst du schon selbst erklären? Nimm dir zuerst nur den ersten Schritt vor: ' + activity.hints[0]
  if (review && /feedback|verbesser|fehlt|erklär/i.test(message)) {
    const gap = review.criteria?.find((item) => !item.met)
    return gap ? gap.explanation + ' Welchen Teil deines Versuchs würdest du dazu ändern?' : 'Die Kriterien deines Versuchs sind im Demo-Check erkennbar. Wie würdest du das Prinzip auf eine andere Situation übertragen?'
  }
  return activity.hints[Math.min(hintLevel, activity.hints.length - 1)]
}
