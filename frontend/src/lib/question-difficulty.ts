import type { BloomStage, LearningQuestion } from './types'

export type DifficultyLabel = 'Schwierig' | 'Genau richtig' | 'Leicht'

export function questionDifficultyClass(label: DifficultyLabel): string {
  if (label === 'Leicht') return 'border-difficulty-easy-border bg-difficulty-easy text-difficulty-easy-foreground'
  if (label === 'Genau richtig') return 'border-difficulty-right-border bg-difficulty-right text-difficulty-right-foreground'
  return 'border-difficulty-hard-border bg-difficulty-hard text-difficulty-hard-foreground'
}

const stageDifficulty: Record<BloomStage, DifficultyLabel> = {
  Remember: 'Leicht',
  Understand: 'Leicht',
  Apply: 'Genau richtig',
  Analyze: 'Schwierig',
  Evaluate: 'Schwierig',
  Create: 'Schwierig',
}

/** Prefer Lea's saved rating; otherwise show a simple estimate from the learning stage. */
export function questionDifficulty(question: Pick<LearningQuestion, 'difficultyLabel' | 'stage'>): DifficultyLabel {
  return question.difficultyLabel ?? stageDifficulty[question.stage]
}
