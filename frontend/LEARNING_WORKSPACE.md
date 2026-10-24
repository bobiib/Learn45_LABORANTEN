# Question and review workspace

The desktop learning workspace is implemented in `src/components/learning-session.tsx`. It coordinates task, review and session-summary states; `App.tsx` supplies the selected topic/question and receives independent progress updates.

## Demo flows

- Continue Lea's session to open the prompting writing task.
- Choose 5, 15 or 30 minutes, or enter a whole number from 5 to 180 before a fresh session. A valid saved session keeps its budget and place. **Aufgabe** and **Material** separate practice from its source. The inline **Lernhilfe öffnen** action reveals a contextual explanation and records the attempt as supported; merely reading the required source material does not.
- The coach starts closed, with an empty body and **Coach hinzunehmen**. Choose **Mit KI** or that action for stepped, streamed coaching. Opening the empty coach alone does not count as help. Asking it a question records AI support, which remains recorded when switching back to solo.
- Choose **Zu zweit**, enter the second person's name, and complete the sequence: Lea's answer → screen handoff → second answer → comparison → shared answer. Roles change with the Bloom stage (for example developer/tester at Create). The tester can write test cases without uploading a second artifact. The AI coach remains available; its conversation resets and starts closed for each turn. Support stays recorded across the round; the theory explanation closes when passing the screen. This is a turn-taking aid on one computer, not an authentication or privacy boundary. A joint success is followed by independent transfer on the same thinking level.
- Open **Mit Python etwas Eigenes bauen** from the dashboard for the file-based Creating example. Choose a `.py`, `.txt` or `.zip` file, then explain the test cases.

## Task formats

Within a saved learning session, each completed pair round advances the role rotation for the next task or new unit. The next pair round starts with the other person, so the two people exchange the stage-specific roles. Retrying, reloading, switching learning modes or leaving an unfinished round does not rotate roles. The assignment also determines handoff names, comparison labels, artifact ownership and coach turn context. The independent follow-up after joint success remains available before returning to pair work.

`LearningActivity` in `src/lib/types.ts` contains the task snapshot, Bloom stage, source material, criteria, hints, estimated minutes and optional choices/file types. `src/lib/learning-engine.ts` provides a small explicit activity bank and a deterministic demo evaluator. Formats are writing, selection with justification, marking unsupported claims, and artifact submission. Tasks stay fixed while an answer is being written.

`src/lib/learning-content.ts` supplies contextual theory, three-part mini-project outlines and roles for every Bloom stage. The structure accepts any subject; this prototype includes prepared prompting and Python content. Unknown subjects explicitly need verified material. Changing the learning mode refits a task only while its answer is empty.

The demo uses regular expressions and exact option checks. This is not a semantic LLM assessment. Source-dependent choices retain their matching source when the next task varies. Unknown rubrics, PDF/DOCX/ZIP content, and code behavior are marked pending rather than certified. Python text is previewed; it is never executed.

## Adaptation and time

- A weak result produces a smaller, targeted task; repeated difficulty or a “too hard” rating offers coaching. No unseen hint is counted or inserted automatically into a closed coach.
- Supported and joint results are stored separately. A successful supported attempt is followed by a new solo task on the same thinking level. Reviewing and retrying the same task counts as support. Opening theory records a round-wide `theoryViewed` flag without increasing AI hint counts or reducing answer correctness. It does not add independent mastery evidence; a new unaided case does.
- With at least five comparable independent attempts on the same skill and Bloom stage, the demo uses an 80–90% success band to retain or increase challenge. Before that it makes conservative task-level decisions and shows no numeric probability.
- The 85% target is an experimental product heuristic, not a universal mastery threshold or a grade.
- Active time starts after choosing the budget and pauses when the browser tab is hidden. Task fitting includes theory and a short closing reflection; paired estimates include both individual turns and synthesis. A brief session narrows the criterion or starts with a project plan. The learner can add five minutes or finish early. Estimates are guidance rather than a forced countdown.
- Text, mode, pair phase, feedback and elapsed time are stored locally per entry question. File data is kept only in memory, never serialized to browser storage. Reopening a draft requires choosing its attachment again. Storage errors are shown without disabling the current session.

## Backend integration contract

The existing `learningApi` adapter remains the boundary. With `VITE_DEMO_MODE=false`, no scripted review is substituted for a failed request.

`POST /api/questions/answer` accepts the existing answer fields plus the activity snapshot, selected option identifiers, `learningMode`, optional `theoryUsed` and aggregate `supportUsed`. Theory support is distinct from `tutorUsed` and `hintsUsed`, which describe AI usage. `supportUsed` also covers reviewing feedback before retrying, without labelling that as AI usage. Without a file it is JSON. With a file it is `multipart/form-data` containing `file` and `submission` (JSON metadata). The backend must use its own trusted task/rubric definitions; client-provided criteria and option correctness are not authoritative.

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
