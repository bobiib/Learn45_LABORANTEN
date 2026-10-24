## Shape & Settled Decisions

- Topic: stress-test the proposed frontend MVP pages and learning mechanics for the Learn45 hackathon.
- The product is a single-learner MVP, following Lea; authentication and a multi-user system are out of scope.
- The current planned surfaces are a landing/dashboard, topic page, question interface, and review/feedback interface.
- The current turn focuses on frontend behavior and visible state; backend and exact recommendation logic are deferred.
- The user wants the page design checked against the project PDFs and the two attached reference images.
- The checkpoint path is the project root file `grill-learn45-pages.md`, selected by the user.
- The demo scenario is Lea learning to write precise AI prompts for project notes, chosen to map directly to the challenge brief.
- The progress visualization keeps all six Bloom labels. Remembering, Understanding, and Applying cap the topic bar at 25%, 50%, and 75%; after Applying, any one of Analyzing, Evaluating, or Creating may provide the evidence for the final 25%.
- The 85% idea is a prototype heuristic, not a proven universal target. Candidate observable signals are first-try correctness, hint use, and Lea's own difficulty rating.
- The exact demo topic may generalize, but the first content and copy should center on Lea's project-note prompt task.
- Before the backend exists, AI-generated content and chat should use seeded, scripted local data consistent across pages.
- Do not show a numeric 85% target to Lea. Offer progressive hints and collect a simple task-difficulty rating (too easy / about right / too hard).
- Each submitted answer should lead to review with feedback, visible progress evidence, and a short explanation of the next recommended activity or learning mode.
- All four page shells should exist in the frontend MVP, but effort should prioritize one complete seeded journey across them; settings, logout, topic discovery, and other non-core panels may remain decorative or fixture-backed.
- The React Flow learning plan should be read-only. Clicking a node filters the question list to that selected subtopic.
- Show Lea's learning facts in an editable context card near the plan.
- Bloom progress can increase from partly correct responses; it is not all-or-nothing.
- Correct answers after assistance should increase progress less than independent correct answers.
- The selected graph node filters the question list to that subtopic; further node detail behavior remains open.
- Learning facts should be editable in a context card near the plan.
- Include offline partner activities as the lightweight social-learning option, without multi-user accounts or in-app pairing/shared state.
- The agent recommends AI coaching when appropriate, but Lea controls whether it is enabled or accepted.
- During an answer, offer three stepped hints and a separate optional tutor chat; track hint use as an observable input to progress evidence.
- Use a simple frontend demo rubric: independent correct answers earn full evidence, hinted correct answers earn reduced evidence, partially correct answers earn small rubric-based evidence, and incorrect answers earn no positive evidence but remain available for adaptation.
- Selecting a learning-plan node both filters questions and opens a compact detail view with prerequisites, Bloom evidence, progress, and one suggested question.
- Partner activities should say when a real partner is needed and offer a solo alternative with the same learning objective.
- Lea's first-use flow begins by adding lecture notes, then using a scripted AI conversation to narrow what she wants to learn and produce seeded subtopic questions, a learning-plan graph, and editable learner-context facts.
- Returning Lea skips setup and can start from existing notes, plan, questions, and facts; she may choose a specific topic, apply filters, or start recommended questions directly.
- The plan should be a directed acyclic graph. For question recommendations, candidate nodes have no prerequisites or only prerequisites already started or completed; the true recommendation logic is deferred to the backend.
- For the frontend prototype, persist Lea's editable context in browser storage behind a small data layer, then replace that persistence with the backend later.
- The live demo should show first-use setup (notes → AI scope conversation → generated plan/questions), then jump to returning-user practice.
- Seed the learning-plan DAG with visible eligible and waiting subtopics and scripted questions for eligible nodes; defer recommendation decisions to the backend.

## Question Log

### Round 1

- **Q1 — Demo scenario:** Which scenario should anchor the demo?
  - **Answer:** Lea improving AI prompts with project notes.
  - **Settled:** Use the challenge's Lea scenario to make the prototype directly legible against the brief.
- **Q2 — Progress meaning:** How should the six Bloom categories relate to the four progress caps?
  - **Answer:** Keep six labels; the first three cap progress at 25%, 50%, and 75%. The top three are parallel alternatives; any one can provide evidence for the final 25%.
  - **Settled:** The graph should preserve the three top-level alternatives instead of making Analyze, Evaluate, and Create a mandatory sequence.
- **Q3 — 85% rule:** How should the idea work in the prototype?
  - **Answer:** Use it as a heuristic with observable signals.
  - **Settled:** Consider first-attempt correctness, hints used, and a learner difficulty rating; do not present 85% as established human-learning law.
- **Q4 — Mock AI behavior:** How should AI parts behave before the backend exists?
  - **Answer:** Use scripted local demo data.
  - **Settled:** Keep questions, chat, graph, and review on consistent seeded fixtures.
- **Q5 — Learner-facing 85%:** Should Lea see the number?
  - **Answer:** No; use progressive hints and a difficulty rating instead.
  - **Settled:** Do not show an 85% meter or badge. Collect too easy / about right / too hard feedback.
- **Q6 — Recommendation timing:** What triggers the recommendation?
  - **Answer:** After every submitted answer.
  - **Settled:** Review explains the feedback, progress evidence, and the next activity or mode.
- **Q7 — First frontend slice:** What should be genuinely functional?
  - **Answer:** All four shells, with one complete journey.
  - **Settled:** Keep the four pages navigable, but prioritize the seeded learning loop; peripheral features can remain decorative or fixture-backed.
- **Q8 — Graph interaction:** How should Lea use the React Flow plan?
  - **Answer:** Read-only; clicking a node filters questions to that topic.
  - **Settled:** Do not support graph topology editing. Node selection drives the question list filter.
- **Q9 — Learner context:** Where should Lea review facts used by the agent?
  - **Answer:** An editable context card near the plan.
  - **Settled:** Make learner context visible and correctable outside the chat transcript.
- **Q10 — Progress evidence:** How do correctness and help affect progress?
  - **Answer:** Assisted correct answers advance the bar less than independent correct answers; slightly wrong answers also advance it somewhat.
  - **Settled:** Use graded, partial evidence, with an assistance discount; do not make progress binary.
- **Q11 — Tutor control:** How does the AI recommendation interact with the tutor preference?
  - **Answer:** The agent recommends; Lea controls.
  - **Settled:** Explain the coaching recommendation and let Lea accept/decline or keep the tutor disabled.
- **Q12 — Social learning scope:** How do multiple-person activities fit a single-learner MVP?
  - **Answer:** Include offline partner activities.
  - **Settled:** Social exercises can use a real colleague outside the app; do not build accounts, pairing, or shared state.
- **Q13 — Hint interaction:** How should hints work during an answer?
  - **Answer:** Three stepped hints plus optional chat.
  - **Settled:** Offer hints in sequence, keep freeform tutor chat separately optional, and record the hint count.
- **Q14 — Partial progress:** What counts as progress after an attempt?
  - **Answer:** Use the recommended simple demo rubric.
  - **Settled:** Independent correct earns full evidence, hinted correct earns reduced evidence, partly correct earns small rubric-based evidence, and incorrect earns no positive evidence but remains usable for adaptation.
- **Q15 — Graph selection:** What should selecting a node reveal?
  - **Answer:** Filter plus detail panel.
  - **Settled:** Selecting a node filters questions and shows prerequisites, Bloom evidence, progress, and a suggested question.
- **Q16 — Context persistence:** Should Lea's context edits persist in the demo?
  - **Answer:** Asked whether saving directly in a backend now is preferable because an LLM backend will be needed later.
  - **Status:** Open. Recommendation: use a frontend data layer with browser storage for the prototype, then substitute backend persistence when the backend exists.
- **Q17 — Partner fallback:** What happens without a partner?
  - **Answer:** Show a partner notice and a solo alternative.
  - **Settled:** Keep the same learning objective available for solo practice.
- **Q18 — Demo journey:** What is Lea's entry flow?
  - **Answer:** First-time Lea uploads lecture notes, has a scripted AI conversation to narrow the learning scope, then gets seeded questions across subtopics and Bloom levels, a React Flow learning plan, and learner-context facts. Returning Lea skips setup and can start recommended questions or choose a topic or filters.
  - **Settled:** Support both first-use and returning-user states in the design; the recommendation eligibility depends on plan-node prerequisites.
- **Q19 — Context persistence:** Should edits persist in this frontend slice?
  - **Answer:** Use browser storage now; backend later.
  - **Settled:** Put persistence behind a small data layer so browser storage can later be replaced by account-backed backend storage.
- **Q20 — Live demo path:** Which flow should anchor the demo?
  - **Answer:** Show setup, then returning practice.
  - **Settled:** Demonstrate the first-use setup once, then show that Lea can start recommended practice immediately on a later visit.
- **Q21 — Prerequisite display:** How much eligibility should be visible in the frontend?
  - **Answer:** Show eligible/waiting states in the fixture.
  - **Settled:** Use a seeded acyclic graph and visibly mark eligible versus waiting subtopics; scripted questions are available for eligible nodes, while real recommendation logic remains backend work.

## Open Flags

- The submitted challenge requires a complete visible loop (challenge, action, feedback, adaptation, progress), a reasoned next-step recommendation, and at least two modes. Solo plus AI can satisfy the mode count; social learning still appears in the scoring rubric, and the self-check accepts a concrete planned extension.
- The 85% screenshot describes a result for a class of stochastic-gradient-descent learning algorithms in binary-classification settings, with neural/perceptual-learning models. It does not establish a universal 85% success target for human educational questions or AI tutoring.
- Numeric scoring weights for the demo evidence rubric remain intentionally unspecified; the UI should show qualitative evidence without invented precision.
- Social learning is outside the stated single-learner MVP. Solo and AI modes can satisfy the two-mode requirement; social learning remains a scored criterion and may be documented as a concrete extension.
- The first-use upload and AI plan generation are frontend simulations using seeded responses, not live document processing or LLM generation.

## Criteria

- **Pre-mortem failure mode:** The learning loop feels unclear; the scripted setup does not make it evident how Lea's notes and AI conversation lead to a useful next question.
- **Criterion 1 — Traceable learning loop:** **Pass** if a viewer can follow the demo from uploaded notes to the scoped learning goal, generated plan subtopic and question, Lea's answer, feedback/progress evidence, and the next recommended activity, and can explain why that activity follows. **Fail** if any transition is missing or the reason for the next activity is unclear.
