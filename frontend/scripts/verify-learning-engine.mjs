import assert from 'node:assert/strict'
import { evaluatePractice, fitActivityToBudget, nextActivity, practiceActivities, coachReply } from '../src/lib/learning-engine.ts'
import { activityTime, pairLearners, pairRoles, projectFor, theoryFor } from '../src/lib/learning-content.ts'

assert.deepEqual(pairLearners('Noah', 0), { first: 'Lea', second: 'Noah' })
assert.deepEqual(pairLearners('Noah', 1), { first: 'Noah', second: 'Lea' }, 'The next pair round exchanges the people assigned to development and checking.')
assert.deepEqual(pairLearners('Noah', 2), { first: 'Lea', second: 'Noah' })

const activity = practiceActivities.find((item) => item.id === 'q-criteria')
const base = { questionId: activity.id, activity, hintsUsed: 0, tutorUsed: false, learningMode: 'solo', difficulty: null }
const answer = 'Erstelle höchstens fünf Stichpunkte für die Projektleitung. Nenne Aufgaben mit Verantwortlichen. Markiere fehlende Fristen als offen.'
const result = evaluatePractice({ ...base, answer })
assert.equal(result.correctness, 'strong')
assert.ok(result.criteria.every((item) => item.met))
assert.equal(evaluatePractice({ ...base, answer: 'Mach es einfach gut.' }).correctness, 'incorrect')
const theoryResult = evaluatePractice({ ...base, answer, theoryUsed: true })
assert.equal(theoryResult.evidenceLabel, 'Mit Unterstützung erarbeitet', 'Viewed theory counts as assistance without inventing AI use.')
assert.equal(theoryResult.correctness, result.correctness, 'Seeking help does not turn a correct answer into an incorrect one.')
const feedbackOnlyResult = evaluatePractice({ ...base, answer, supportUsed: true, tutorUsed: false, theoryUsed: false, hintsUsed: 0 })
assert.equal(feedbackOnlyResult.evidenceLabel, 'Mit Unterstützung erarbeitet', 'Feedback-only retries count as assisted without inventing AI or theory use.')
assert.equal(feedbackOnlyResult.correctness, result.correctness)
const theoryTransfer = nextActivity(activity, theoryResult, [{ activityId: activity.id, skillId: activity.skillId, stage: activity.stage, correctness: 'strong', supported: true, mode: 'solo', at: 1 }], null)
assert.equal(theoryTransfer.stage, activity.stage)
assert.notEqual(theoryTransfer.scenario.text, activity.scenario.text, 'Theory-assisted work is followed by an independent case at the same thinking level.')

assert.equal(fitActivityToBudget(activity, 15), activity, 'An adequate budget preserves the original task.')
const shortTask = fitActivityToBudget(activity, 5)
assert.equal(shortTask.minutes, 2)
assert.equal(shortTask.stage, activity.stage)
assert.equal(shortTask.criteria.length, 1, 'A five-minute unit practices one criterion rather than rushing the full task.')
assert.equal(shortTask.criteria[0].id, 'format')
assert.equal(activity.criteria.length, 4, 'Budget adaptation must not mutate the shared activity.')
assert.equal(evaluatePractice({ ...base, activity: shortTask, answer: 'Schreibe höchstens fünf Stichpunkte.' }).correctness, 'strong')
const shortPairTask = fitActivityToBudget(shortTask, 5, 'together')
assert.equal(shortPairTask.minutes, 1, 'Switching an empty short session to pair work must leave time for both people.')
assert.equal(shortPairTask.criteria.length, 1)
assert.equal(activityTime(shortPairTask, 'together'), 5)
for (const task of practiceActivities) {
  for (const mode of ['solo', 'coach', 'together']) {
    const exactBudget = activityTime(task, mode)
    assert.equal(fitActivityToBudget(task, exactBudget, mode), task, 'A task that exactly fits theory, practice and closure should be preserved.')
    for (const budget of [5, 15, 30]) {
      const fitted = fitActivityToBudget(task, budget, mode)
      assert.ok(activityTime(fitted, mode) <= budget, `${task.id} in ${mode} must fit its ${budget}-minute unit including theory and closure.`)
    }
  }
}

const attempt = { activityId: activity.id, skillId: activity.skillId, stage: activity.stage, correctness: 'strong', supported: true, mode: 'coach', at: 1 }
const transfer = nextActivity(activity, result, [attempt], null)
assert.equal(transfer.stage, activity.stage, 'A coached success needs an independent attempt at the same thinking level.')
assert.equal(transfer.skillId, activity.skillId)
assert.ok(transfer.transfer)
assert.notEqual(transfer.scenario.text, activity.scenario.text)
const jointResult = evaluatePractice({ ...base, answer, learningMode: 'together', tutorUsed: true, hintsUsed: 1 })
assert.equal(jointResult.evidenceLabel, 'Gemeinsam erarbeitet')
const jointTransfer = nextActivity(activity, jointResult, [{ ...attempt, supported: false, mode: 'together' }], null)
assert.equal(jointTransfer.stage, activity.stage, 'Joint success also needs an independent attempt at the same thinking level.')
assert.equal(jointTransfer.skillId, activity.skillId)
assert.ok(jointTransfer.transfer)

const difficult = nextActivity(activity, result, [{ ...attempt, supported: false, mode: 'solo' }], 'too-hard')
assert.equal(difficult.stage, 'Understand')
assert.equal(difficult.format, 'choose')
assert.equal(difficult.skillId, activity.skillId)

const analysis = nextActivity(activity, result, [{ ...attempt, supported: false, mode: 'solo' }], null)
assert.equal(analysis.format, 'spot')
assert.ok(analysis.scenario.text.includes('Nora'), 'Source-dependent statements must keep matching their source.')

const regular = Array.from({ length: 6 }, (_, index) => ({ ...attempt, supported: false, mode: 'solo', correctness: index === 0 ? 'partial' : 'strong' }))
assert.equal(nextActivity(activity, result, regular, null).stage, activity.stage, 'Do not escalate when comparable performance is already in the target zone.')
assert.equal(nextActivity(activity, result, regular, 'too-easy').stage, 'Analyze')

const python = practiceActivities.find((item) => item.id === 'q-python-create')
assert.equal(activityTime(python), 14, 'Python includes its two-minute theory and a two-minute closure.')
assert.equal(activityTime(python, 'together'), 24, 'Pair work includes both ten-minute attempts and shared closure.')
assert.equal(fitActivityToBudget(python, 13).format, 'write', 'A thirteen-minute unit cannot fit the full Python task and its two-minute theory.')
const fileResult = evaluatePractice({ ...base, activity: python, answer: 'Ein Sieg und ein Unentschieden werden getestet.', attachment: { name: 'game.py' }, attachmentText: 'board = []\nplayer = "X"\nvalue = input()\ndef winner(): pass' })
assert.equal(fileResult.assessmentPending, true)
assert.equal(fileResult.evidenceDelta, 0, 'Source text is not evidence of correct program execution.')
assert.equal(evaluatePractice({ ...base, activity: python, answer: 'Tests beschrieben.', attachment: { name: 'game.zip' } }).assessmentPending, true)
assert.ok(!coachReply(activity, 'Feedback erklären', 0, result).includes('undefined'))
assert.ok(coachReply(activity, 'Gib mir die fertige Lösung', 0).includes('ersten Schritt'))

// Every task needs a usable conceptual entry point and a project small enough to explain at a glance.
for (const task of [...practiceActivities, transfer, difficult, analysis, jointTransfer]) {
  const theory = theoryFor(task)
  assert.ok(theory.title.trim() && theory.principle.trim() && theory.takeaway.trim(), `Missing theory for ${task.id}`)
  assert.ok(theory.example.before.trim() && theory.example.after.trim() && theory.example.explanation.trim())
  assert.notEqual(theory.example.before, theory.example.after, 'The example must show a meaningful change.')
  assert.ok(theory.minutes > 0 && theory.minutes <= 2, 'Theory should fit inside a short study session.')
  const project = projectFor(task)
  assert.equal(project.steps.length, 3)
  assert.ok(project.steps.every((step) => step.trim()))
  assert.ok(project.currentStep >= 0 && project.currentStep < project.steps.length)
}
assert.equal(theoryFor(transfer).title, theoryFor(activity).title, 'Generated transfer IDs retain the relevant conceptual foundation.')
assert.notEqual(theoryFor(analysis).title, theoryFor(activity).title, 'Source analysis needs different theory from writing criteria.')
const pythonRetry = nextActivity(python, fileResult, [], null)
assert.notEqual(theoryFor(pythonRetry).title, theoryFor(python).title, 'The smaller Python task needs theory about its isolated subproblem.')
assert.equal(projectFor(pythonRetry).title, projectFor(python).title)
const unknown = { ...activity, id: 'q-new-subject', skillId: 'new-subject' }
assert.match(theoryFor(unknown).principle, /keine fachlich geprüfte Theorie/, 'Unknown subjects must not receive invented domain theory.')
const oversized = { ...unknown, minutes: 20, stage: 'Create', format: 'artifact' }
const planning = fitActivityToBudget(oversized, 5)
assert.equal(planning.minutes, 2)
assert.equal(planning.stage, 'Understand')
assert.equal(planning.format, 'write')
assert.equal(planning.skillId, oversized.skillId)
assert.ok(planning.prompt.includes(oversized.title), 'The short planning task keeps the original learning goal.')
assert.equal(planning.options, undefined)
assert.equal(planning.selectCount, undefined)
const planningResult = evaluatePractice({ ...base, activity: planning, answer: 'Ich notiere die Regel und einen passenden Prüffall.' })
assert.equal(planningResult.assessmentPending, true, 'A generic plan cannot certify subject mastery without a rubric.')
assert.equal(planningResult.evidenceDelta, 0)

const stages = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']
const goals = new Set()
for (const stage of stages) {
  const roles = pairRoles(stage)
  assert.ok(roles.goal.trim() && roles.sharedPrompt.trim())
  assert.ok(roles.first.name.trim() && roles.first.prompt.trim() && roles.second.name.trim() && roles.second.prompt.trim())
  assert.notEqual(roles.first.name, roles.second.name, `${stage} needs complementary roles.`)
  assert.notEqual(roles.first.prompt, roles.second.prompt)
  goals.add(roles.goal)
}
assert.equal(goals.size, stages.length, 'Pair work should change its learning goal across the six Bloom stages.')
assert.match(pairRoles('Create').second.prompt, /Prüffälle|Test/, 'Creative work includes explicit peer testing.')
console.log('Learning engine: rubric, time-budget adaptation, independent transfer after support/pair work, difficulty, source consistency, file boundaries, contextual theory, project structure and all Bloom pair roles passed.')
