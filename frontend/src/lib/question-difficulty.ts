import type { BloomStage, LearningQuestion } from './types'

export type DifficultyLabel = 'Schwierig' | 'Genau richtig' | 'Leicht'

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
