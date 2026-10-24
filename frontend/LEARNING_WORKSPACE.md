# Question and review workspace

The desktop learning workspace is implemented in `src/components/learning-session.tsx`. It coordinates task, review and session-summary states; `App.tsx` supplies the selected topic/question and receives independent progress updates.

## Demo flows

- Continue Lea's session to open the prompting writing task.
- Choose 5, 15 or 30 minutes before a fresh session. A valid saved session keeps its budget and place. **Aufgabe**, **Kurz erklärt** and **Material** separate practice, a contextual explanation with an example, and its source.
- Choose **Mit KI** or **Coach hinzunehmen** for stepped, streamed coaching. Assistance remains recorded when switching back to solo.
- Choose **Zu zweit**, enter the second person's name, and complete the sequence: Lea's answer → screen handoff → second answer → comparison → shared answer. Roles change with the Bloom stage (for example developer/tester at Create). The tester can write test cases without uploading a second artifact. The AI coach remains available; its conversation resets for each turn and is hidden during handoff. Support stays recorded across the round. This is a turn-taking aid on one computer, not an authentication or privacy boundary. A joint success is followed by independent transfer on the same thinking level.
- Open **Mit Python etwas Eigenes bauen** from the dashboard for the file-based Creating example. Choose a `.py`, `.txt` or `.zip` file, then explain the test cases.

## Task formats

`LearningActivity` in `src/lib/types.ts` contains the task snapshot, Bloom stage, source material, criteria, hints, estimated minutes and optional choices/file types. `src/lib/learning-engine.ts` provides a small explicit activity bank and a deterministic demo evaluator. Formats are writing, selection with justification, marking unsupported claims, and artifact submission. Tasks stay fixed while an answer is being written.

`src/lib/learning-content.ts` supplies contextual theory, three-part mini-project outlines and roles for every Bloom stage. The structure accepts any subject; this prototype includes prepared prompting and Python content. Unknown subjects explicitly need verified material. Changing the learning mode refits a task only while its answer is empty.

The demo uses regular expressions and exact option checks. This is not a semantic LLM assessment. Source-dependent choices retain their matching source when the next task varies. Unknown rubrics, PDF/DOCX/ZIP content, and code behavior are marked pending rather than certified. Python text is previewed; it is never executed.

## Adaptation and time

- A weak result produces a smaller, targeted task; repeated difficulty or a “too hard” rating offers coaching.
- Supported and joint results are stored separately. A successful supported attempt is followed by a new solo task on the same thinking level. Reviewing and retrying the same task counts as support.
- With at least five comparable independent attempts on the same skill and Bloom stage, the demo uses an 80–90% success band to retain or increase challenge. Before that it makes conservative task-level decisions and shows no numeric probability.
- The 85% target is an experimental product heuristic, not a universal mastery threshold or a grade.
- Active time starts after choosing the budget and pauses when the browser tab is hidden. Task fitting includes theory and a short closing reflection; paired estimates include both individual turns and synthesis. A brief session narrows the criterion or starts with a project plan. The learner can add five minutes or finish early. Estimates are guidance rather than a forced countdown.
- Text, mode, pair phase, feedback and elapsed time are stored locally per entry question. File data is kept only in memory, never serialized to browser storage. Reopening a draft requires choosing its attachment again. Storage errors are shown without disabling the current session.

## Backend integration contract

The existing `learningApi` adapter remains the boundary. With `VITE_DEMO_MODE=false`, no scripted review is substituted for a failed request.

`POST /api/questions/answer` accepts the existing answer fields plus the activity snapshot, selected option identifiers and `learningMode`. Without a file it is JSON. With a file it is `multipart/form-data` containing `file` and `submission` (JSON metadata). The backend must use its own trusted task/rubric definitions; client-provided criteria and option correctness are not authoritative.

`POST /api/tutor/stream` retains AI SDK UI messages and adds a `context` object with the current activity, draft text, feedback, learning mode and optional `turnContext` (current paired role). The stream remains UTF-8 plain text. Attachments and the other person's hidden draft are not sent to the coach. The backend team must implement extraction and isolated code assessment before file submissions can receive a real verdict.

`ReviewResult` optionally includes `criteria` and `assessmentPending`; older feedback responses still render. A pending result does not change mastery. Assistance never reduces an earned score; independent evidence is tracked separately.

## Verification

```powershell
npm run build
npm run lint
node --experimental-strip-types scripts/verify-learning-engine.mjs
```

The browser smoke check needs an available Playwright installation and Chrome. Point `PLAYWRIGHT_MODULE_PATH` to an installed Playwright package if it is not resolvable locally, start the site, then run:

```powershell
$env:LEARNING_QA_URL = 'http://127.0.0.1:4173'
node scripts/verify-learning-ui.mjs
```

Screenshots and isolated browser profiles go into ignored `node_modules/.cache/learn45-qa`. The check exercises solo, keyboard popovers, rating adaptation, coach evidence, persistence, remaining-time handling, paired learning, attachment validation/preview, pending code review, reduced motion and narrow layout.
