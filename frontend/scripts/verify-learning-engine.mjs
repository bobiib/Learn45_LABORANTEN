import assert from 'node:assert/strict'
import { evaluatePractice, nextActivity, practiceActivities, coachReply } from '../src/lib/learning-engine.ts'

const activity = practiceActivities.find((item) => item.id === 'q-criteria')
const base = { questionId: activity.id, activity, hintsUsed: 0, tutorUsed: false, learningMode: 'solo', difficulty: null }
const answer = 'Erstelle höchstens fünf Stichpunkte für die Projektleitung. Nenne Aufgaben mit Verantwortlichen. Markiere fehlende Fristen als offen.'
const result = evaluatePractice({ ...base, answer })
assert.equal(result.correctness, 'strong')
assert.ok(result.criteria.every((item) => item.met))
assert.equal(evaluatePractice({ ...base, answer: 'Mach es einfach gut.' }).correctness, 'incorrect')

const attempt = { activityId: activity.id, skillId: activity.skillId, stage: activity.stage, correctness: 'strong', supported: true, mode: 'coach', at: 1 }
const transfer = nextActivity(activity, result, [attempt], null)
assert.equal(transfer.stage, activity.stage, 'A coached success needs an independent attempt at the same thinking level.')
assert.equal(transfer.skillId, activity.skillId)
assert.ok(transfer.transfer)
assert.notEqual(transfer.scenario.text, activity.scenario.text)

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
const fileResult = evaluatePractice({ ...base, activity: python, answer: 'Ein Sieg und ein Unentschieden werden getestet.', attachment: { name: 'game.py' }, attachmentText: 'board = []\nplayer = "X"\nvalue = input()\ndef winner(): pass' })
assert.equal(fileResult.assessmentPending, true)
assert.equal(fileResult.evidenceDelta, 0, 'Source text is not evidence of correct program execution.')
assert.equal(evaluatePractice({ ...base, activity: python, answer: 'Tests beschrieben.', attachment: { name: 'game.zip' } }).assessmentPending, true)
assert.ok(!coachReply(activity, 'Feedback erklären', 0, result).includes('undefined'))
assert.ok(coachReply(activity, 'Gib mir die fertige Lösung', 0).includes('ersten Schritt'))
console.log('Learning engine: rubric, transfer, support, difficulty, source consistency and file boundaries passed.')
