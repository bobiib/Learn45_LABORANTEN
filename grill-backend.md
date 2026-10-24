# Backend MVP grill checkpoint

## Shape & Settled Decisions

- The goal is a locally runnable MVP backend for Lea's learning app.
- The MVP has one learner (Lea); multi-user authentication is not a current requirement.
- Focus on persistent learning data and API-based AI interactions.
- General tutor and answer-review interactions can rebuild their context on each request; persistent AI conversation management is unnecessary for those sessions.
- The topic-page interaction is the only planned agentic AI area and is out of scope for the first MVP.
- Initial recommendation: FastAPI, SQLite, and local filesystem storage for uploaded files.
- The repository already has a FastAPI health route and a README-defined frontend API contract; there is no implemented backend beyond health yet.
- The checkpoint location `grill-backend.md` at the repository root is approved.
- Use OpenAI's hosted API for AI calls; drop the Ollama route.
- SQLite is acceptable for the local MVP.
- Scanned-PDF OCR is required in v1, in addition to extracting selectable text from supported source files.
- A bounded OpenAI call should generate an initial topic plan and questions from each uploaded source; exclude ongoing topic-page agentic plan adjustment.
- Keep initial setup as simple chat/context filling to capture the learner's goal before generating the plan; exclude later agentic plan changes from the topic page.
- Extracted source excerpts and learner answers may be sent to OpenAI for those tasks, with secrets kept server-side.
- Persist answer attempts, feedback, support used (hints/tutor), difficulty ratings, and progress locally; discard chat transcripts at session end.
- The reusable learning-habits skill should use recall before explanation, graduated hints rather than answer-giving, kind and specific feedback, self-explanation/reflection, and adaptive challenge without treating progress as a grade.
- Support English and German extraction and OCR.
- For the MVP, ordinary AI responses use no tools. Reserve agentic AI and its tool access for later; any future tool-mediated action requires an explicit human confirmation modal before execution.
- Proposed implementation shape: one locally run FastAPI service, SQLite for application records, and a local uploads directory; keep OpenAI credentials on the server. Add a small provider/service layer for plan generation, answer review, and tutor responses, with no persistent chat store. Use the existing README route contract as the initial API surface.

## Question Log

1. **Where should the MVP backend run?** User: No host is available; make it work locally.
2. **Which AI provider should the local backend call?** User: They are considering Ollama and an OpenAI API key, and think Ollama may enforce JSON output for later agentic features; exact provider setup is unclear.
3. **Where should the checkpoint live?** User approved `grill-backend.md` at the project root.
4. **How should the model integration work?** User is considering Ollama with the OpenAI API, and would like structured JSON output for a future agentic feature.
5. **Provider, database, and extraction choices.** User chose hosted OpenAI (not Ollama), approved SQLite, and answered yes to OCR for scanned PDFs.
6. **Plan generation, API data sharing, and retention.** User approved one bounded initial plan-generation call per uploaded source, sending relevant extracted text and answers to OpenAI, and the recommended learning-record retention (attempts, feedback, hints/tutor use, difficulty, progress; no chat transcript retention).
7. **Learning habits and language support.** User approved recall-first practice, graduated hints, kind and specific feedback, reflection, adaptive challenge without grade framing, and English/German extraction and OCR.
8. **Pre-mortem — what could fail?** User identified AI permission management. Clarified design: current ordinary AI usage should not use tool calling; any later agentic implementation gets a very limited tool allowlist and must show a human-in-the-loop confirmation modal before tool-mediated actions.

## Open Flags

- Choose local OCR dependency/setup details and local backup/export behavior during implementation planning.
- Exact parsing/OCR libraries and setup ergonomics can be selected during implementation; the supported formats and languages are settled.
- Define the learning-habits principles and guardrails before creating the reusable custom skill with the available skill-creator workflow.

## Criteria

- **AI permission/tool safety:** Pass iff all MVP chat/review/plan endpoints run without tool calling. For any later agentic feature, pass iff the agent receives only an explicit allowlist of tools and every tool-mediated action requires a human confirmation modal before execution.
