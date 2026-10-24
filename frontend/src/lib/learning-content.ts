import type { BloomStage, LearningActivity, LearningMode } from './types'

export type TheoryContent = {
  title: string
  principle: string
  example: { before: string; after: string; explanation: string }
  takeaway: string
  minutes: number
  formula?: string
}

export type PairRoles = {
  goal: string
  first: { name: string; prompt: string }
  second: { name: string; prompt: string }
  sharedPrompt: string
}

export type ProjectContent = {
  title: string
  goal: string
  steps: [string, string, string]
  currentStep: 0 | 1 | 2
}

const promptingTheory: Record<string, TheoryContent> = {
  goal: {
    title: 'Vom Wunsch zum Auftrag',
    principle: 'Ein klarer Auftrag verbindet die lesende Person mit dem, was sie anschliessend tun soll.',
    example: {
      before: 'Erkläre die neue Bibliotheksordnung.',
      after: 'Erkläre neuen Mitgliedern, wie sie ein Buch ausleihen und verlängern.',
      explanation: 'Zielgruppe und Handlung bestimmen, welche Informationen wichtig sind.',
    },
    takeaway: 'Überlege zuerst: Für wen ist das Ergebnis, und wofür wird es gebraucht?',
    minutes: 1,
    formula: 'Zielgruppe + gewünschte Handlung = Zweck des Auftrags',
  },
  context: {
    title: 'Kontext mit einer Aufgabe',
    principle: 'Kontext hilft, wenn er das Ergebnis verändert. Wähle Angaben passend zum Zweck und lasse fehlende Fakten offen.',
    example: {
      before: 'Schreibe eine Antwort auf eine Rückgabeanfrage.',
      after: 'Die Kundin möchte einen ungeöffneten Artikel zurückgeben. Nutze die beigefügten Rückgaberegeln; der Kaufbeleg fehlt.',
      explanation: 'Situation und Quelle sind relevant. Eine unbekannte Angabe wird nicht ergänzt.',
    },
    takeaway: 'Frage bei jedem Detail: Würde die Antwort ohne diese Angabe anders ausfallen?',
    minutes: 1,
  },
  criteria: {
    title: 'Qualität sichtbar machen',
    principle: 'Ein Kriterium ist nützlich, wenn du es am fertigen Ergebnis prüfen kannst. Ersetze vage Wünsche durch beobachtbare Vorgaben.',
    example: {
      before: 'Schreibe eine kurze, hilfreiche Anleitung.',
      after: 'Schreibe drei nummerierte Schritte. Jeder Schritt nennt eine Handlung und das erwartete Ergebnis.',
      explanation: 'Anzahl, Aufbau und Inhalt lassen sich direkt am Text kontrollieren.',
    },
    takeaway: 'Formuliere den Auftrag so, dass eine andere Person dieselben Kriterien abhaken könnte.',
    minutes: 1,
    formula: 'Vage Eigenschaft → beobachtbares Merkmal',
  },
  verification: {
    title: 'Aussagen brauchen eine Quelle',
    principle: 'Trenne, was ausdrücklich belegt ist, was du daraus ableitest und was offen bleibt. Plausibel klingt nicht automatisch richtig.',
    example: {
      before: 'Quelle: «Der Raum ist angefragt.» Ergebnis: «Der Raum ist gebucht.»',
      after: 'Der Raum ist angefragt; die Bestätigung steht noch aus.',
      explanation: 'Eine Anfrage belegt keine Zusage. Der Status muss in der Zusammenfassung erhalten bleiben.',
    },
    takeaway: 'Suche für jede überprüfbare Behauptung die passende Stelle im Material.',
    minutes: 1,
  },
  evaluation: {
    title: 'Beurteilen mit Massstab',
    principle: 'Lege zuerst fest, woran ein gutes Ergebnis erkennbar ist. Vergleiche dann die Entwürfe mit denselben Kriterien.',
    example: {
      before: 'Entwurf A klingt für mich besser.',
      after: 'Entwurf A nennt einen nächsten Schritt. In Entwurf B fehlt er; genau das verlangt der Auftrag.',
      explanation: 'Ein begründetes Urteil verbindet Kriterium, Beobachtung und Bedeutung.',
    },
    takeaway: 'Nenne nicht nur deine Wahl, sondern die Textstelle und das Kriterium, die sie tragen.',
    minutes: 1,
    formula: 'Kriterium + Beobachtung + Begründung = nachvollziehbares Urteil',
  },
  template: {
    title: 'Eine Vorlage, viele Fälle',
    principle: 'Eine wiederverwendbare Vorlage trennt feste Regeln von wechselnden Eingaben. Ein neuer Fall zeigt, ob sie wirklich übertragbar ist.',
    example: {
      before: 'Schreibe eine Anleitung für die Anmeldung am 12. Mai.',
      after: 'Erstelle für [Zielgruppe] eine Anleitung zu [Vorgang]. Nutze [Quelle]. Nenne drei Schritte und markiere fehlende Angaben.',
      explanation: 'Platzhalter halten den Inhalt flexibel; die Qualitätsregeln bleiben bestehen.',
    },
    takeaway: 'Teste deine Vorlage mit einem zweiten Fall und mindestens einer fehlenden Angabe.',
    minutes: 2,
  },
}

const pythonTheory: TheoryContent = {
  title: 'Ein Zug ist eine Zustandsänderung',
  principle: 'Speichere Spielfeld und aktive Person getrennt. Prüfe eine Eingabe, bevor sie den Zustand verändert. Wechsle die Person erst nach einem gültigen Zug.',
  example: {
    before: 'Ein belegtes Feld wird gewählt. Trotzdem wechselt die aktive Person.',
    after: 'Das Feld bleibt unverändert; dieselbe Person darf erneut wählen.',
    explanation: 'Ein ungültiger Versuch ist kein Zug. Nach einem gültigen Zug prüfst du zuerst Sieg, dann ein volles Feld und danach den nächsten Zug.',
  },
  takeaway: 'Teste Zustände einzeln: ungültige Eingabe, belegtes Feld, Sieg und volles Feld ohne Sieg.',
  minutes: 2,
  formula: 'Eingabe → prüfen → Zustand ändern → Spielende prüfen → weitergeben',
}

const pythonEndTheory: TheoryContent = {
  title: 'Das Ende unabhängig prüfen',
  principle: 'Die Prüfung des Spielendes soll mit einem vorbereiteten Spielfeld funktionieren. Dafür braucht sie weder eine neue Eingabe noch einen Spielerwechsel.',
  example: {
    before: 'Ein volles Spielfeld wird sofort als Unentschieden gewertet.',
    after: 'Zuerst auf Sieg prüfen. Nur ein volles Feld ohne Sieg ist ein Unentschieden.',
    explanation: 'Auch der letzte freie Platz kann einen Sieg vervollständigen. Die Reihenfolge der Prüfungen ist deshalb entscheidend.',
  },
  takeaway: 'Notiere für jeden Test den Ausgangszustand und das erwartete Ergebnis, bevor du ihn ausführst.',
  minutes: 1,
}

export function theoryFor(activity: LearningActivity): TheoryContent {
  if (activity.id.startsWith('plan-')) {
    const python = activity.skillId === 'python-game'
    const prompting = activity.skillId.startsWith('prompt-')
    return {
      title: 'Ein kleiner, prüfbarer Schritt',
      principle: python
        ? 'Plane einen Teil des Spiels getrennt: Welcher Zustand liegt vorher vor, welche Änderung ist erlaubt und was muss danach gelten?'
        : prompting
          ? 'Plane zuerst ein überprüfbares Merkmal deines Ergebnisses. Eine konkrete Vorgabe ist hilfreicher als mehrere vage Wünsche.'
          : 'Wähle eine Regel aus deinem Lernmaterial und plane nur ihre erste Anwendung. Die fachliche Grundlage muss aus deinen Unterlagen kommen.',
      example: {
        before: 'Ich löse gleich das ganze Projekt.',
        after: 'Ich beschreibe einen Ausgangspunkt, einen kleinen Schritt und ein prüfbares Ergebnis.',
        explanation: 'So kannst du die Idee prüfen, bevor du die vollständige Lösung entwickelst.',
      },
      takeaway: 'Notiere: Was brauche ich, was tue ich und woran erkenne ich, dass es funktioniert?',
      minutes: 1,
    }
  }
  if (activity.skillId === 'python-game' || activity.id.startsWith('q-python')) {
    return activity.id.startsWith('q-python-retry') ? pythonEndTheory : pythonTheory
  }
  if (activity.id.startsWith('scaffold-prompt-')) return promptingTheory.criteria
  if (activity.skillId === 'prompt-goal') return promptingTheory.goal
  if (activity.skillId === 'prompt-context') return promptingTheory.context
  if (activity.skillId === 'prompt-transfer') return promptingTheory.template
  if (activity.skillId === 'prompt-revise') return promptingTheory.evaluation
  if (activity.skillId === 'prompt-criteria') {
    return activity.stage === 'Analyze' || activity.format === 'spot'
      ? promptingTheory.verification
      : promptingTheory.criteria
  }
  return {
    title: 'Vom Material zum ersten Schritt',
    principle: 'Nutze die Begriffe, Regeln oder Formeln aus deinem Lernmaterial. Für dieses Thema ist hier noch keine fachlich geprüfte Theorie hinterlegt.',
    example: {
      before: 'Ich beginne mit einer Vermutung.',
      after: 'Ich suche die passende Regel im Material und notiere, unter welchen Bedingungen sie gilt.',
      explanation: 'Erst die belegte Grundlage klären, dann auf die Aufgabe übertragen. Fehlende Informationen bleiben ausdrücklich offen.',
    },
    takeaway: 'Finde eine passende Materialstelle und erkläre das Prinzip in einem eigenen Satz.',
    minutes: 1,
  }
}

/** Includes the theory shown before practice and a short session closure. */
export function activityTime(activity: LearningActivity, mode: LearningMode = 'solo'): number {
  const theoryMinutes = theoryFor(activity).minutes
  return mode === 'together'
    ? theoryMinutes + activity.minutes * 2 + 1 + 1
    : theoryMinutes + activity.minutes + 2
}

const rolesByStage: Record<BloomStage, PairRoles> = {
  Remember: {
    goal: 'Wissen aus dem Gedächtnis holen',
    first: { name: 'Erinnern', prompt: 'Nenne die wichtigsten Begriffe oder Regeln zunächst ohne Material.' },
    second: { name: 'Abgleichen', prompt: 'Notiere zuerst eigene Begriffe. Prüfe dann mit dem Material, was stimmt und was fehlt.' },
    sharedPrompt: 'Einigt euch auf die drei wichtigsten Punkte. Erklärt euch eine Lücke gegenseitig.',
  },
  Understand: {
    goal: 'Ein Prinzip verständlich erklären',
    first: { name: 'Erklären', prompt: 'Erkläre den Gedanken in eigenen Worten und finde ein kleines Beispiel.' },
    second: { name: 'Nachfragen', prompt: 'Formuliere eine eigene Erklärung. Frage danach gezielt nach dem Warum oder einem Gegenbeispiel.' },
    sharedPrompt: 'Formuliert eine gemeinsame Erklärung, die ihr beide ohne Ablesen wiedergeben könnt.',
  },
  Apply: {
    goal: 'Eine Regel auf einen Fall anwenden',
    first: { name: 'Anwenden', prompt: 'Schlage den ersten Lösungsschritt vor und nenne die passende Regel.' },
    second: { name: 'Vorhersagen', prompt: 'Überlege zuerst selbst, welches Ergebnis die Regel liefern müsste. Prüfe damit den vorgeschlagenen Schritt.' },
    sharedPrompt: 'Bearbeitet den nächsten Schritt mit getauschten Rollen und haltet eure Lösung fest.',
  },
  Analyze: {
    goal: 'Zusammenhänge und Belege finden',
    first: { name: 'Detektivarbeit', prompt: 'Zerlege den Fall: Welche Teile gehören zusammen, und wo liegt eine Auffälligkeit?' },
    second: { name: 'Belegprüfung', prompt: 'Suche unabhängig die Belege im Material. Trenne belegte Aussagen von Annahmen.' },
    sharedPrompt: 'Vergleicht eure Beobachtungen und begründet die wichtigste Verbindung oder Abweichung mit einem Beleg.',
  },
  Evaluate: {
    goal: 'Ein begründetes Urteil bilden',
    first: { name: 'Gutachten', prompt: 'Lege ein Kriterium fest und begründe dein Urteil mit einer konkreten Beobachtung.' },
    second: { name: 'Gegenargument', prompt: 'Bilde zuerst ein eigenes Urteil. Suche dann das stärkste Gegenargument zur ersten Einschätzung.' },
    sharedPrompt: 'Wägt beide Positionen mit denselben Kriterien ab und formuliert ein gemeinsames Urteil.',
  },
  Create: {
    goal: 'Etwas Eigenes entwickeln und prüfen',
    first: { name: 'Entwicklung', prompt: 'Skizziere einen kleinen Entwurf und benenne die wichtigste Entscheidung.' },
    second: { name: 'Test', prompt: 'Notiere vorab zwei Prüffälle: einen normalen Fall und einen Grenzfall.' },
    sharedPrompt: 'Baut einen ersten Stand, prüft ihn mit den Testfällen und tauscht die Rollen für eine Verbesserung.',
  },
}

export function pairRoles(stage: BloomStage): PairRoles {
  return rolesByStage[stage]
}

export function projectFor(activity: LearningActivity): ProjectContent {
  const currentStep = activity.stage === 'Remember' || activity.stage === 'Understand'
    ? 0 : activity.stage === 'Apply' || activity.stage === 'Analyze' ? 1 : 2
  if (activity.skillId === 'python-game' || activity.id.startsWith('q-python')) {
    return {
      title: 'Dein Terminalspiel',
      goal: 'Ein Tic-Tac-Toe, das gültige Züge und das Spielende zuverlässig behandelt.',
      steps: ['Zustand verstehen', 'Züge entwickeln', 'Spiel bauen & testen'],
      currentStep,
    }
  }
  if (activity.skillId.startsWith('prompt-')) {
    return {
      title: 'Vom Auftrag zur Vorlage',
      goal: 'Eine wiederverwendbare Vorlage für verlässliche Projektupdates entwickeln.',
      steps: ['Zweck klären', 'Auftrag formulieren', 'Prüfen & übertragen'],
      currentStep,
    }
  }
  return {
    title: 'Dein Lernprojekt',
    goal: activity.title,
    steps: ['Grundlage klären', 'Anwenden & untersuchen', 'Prüfen & gestalten'],
    currentStep,
  }
}
