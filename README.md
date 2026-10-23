# Learn45 Learning Agent

Hackathon prototype for an adaptive learning journey: solo practice, AI coaching, and learning with peers. The briefs prioritize a visible learning loop, a reasoned next-step recommendation, and evidence that the learner can apply feedback.

## Stack

- React + Vite + TypeScript for the prototype UI
- Tailwind CSS for styling
- `@xyflow/react` for the visible learning journey
- shadcn/ui source components, Tailwind theme tokens, and shared interaction states
- Vercel AI SDK UI (`useChat` with `TextStreamChatTransport`) for streamed tutor and plan conversations
- Python + FastAPI for the learning-agent API and model orchestration

The AI SDK UI runs in React and FastAPI remains the backend. The tutor and plan chats use the AI SDK text stream protocol, which a Python/FastAPI endpoint can return directly; a separate Node server is not required. Add a model provider in the backend when the team chooses one. The demo adapter streams scripted replies locally until those endpoints exist.

The shared shadcn/ui components live in `frontend/src/components/ui/` and are configured by `frontend/components.json`. The project uses the Base UI-backed shadcn style for Tailwind v4. Extend these shared components instead of adding screen-specific controls.

## Start locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Use `npm run lint` to catch raw buttons that bypass the shared interaction styles. The frontend starts in scripted demo mode and stores Lea's context and uploaded-source fixtures in this browser. Copy `frontend/.env.example` to `frontend/.env.local` to configure it.

### Frontend flow

- Dashboard: progress, recent session, topic cards, and upload entry point.
- First-use topic setup: choose a notes file, tell the scripted coach what to focus on, then inspect the generated learning plan and questions.
- Topic space: manage source names, inspect the read-only prerequisite graph, filter questions, and edit Lea's learning context.
- Question and review: answer with optional stepped hints or tutor chat, rate difficulty, see qualitative progress evidence, and follow the explained next recommendation.

The demo uses seeded data and loading delays so the frontend can be worked on before the API is available. In local demo mode the selected filename is recorded, while file contents are not yet extracted or analyzed. Storage calls are isolated behind a small local data layer; mock state is stored in browser `localStorage`.

### FastAPI connection contract

Set `VITE_DEMO_MODE=false` to switch from fixtures to the typed adapter in `frontend/src/lib/api.ts`. Keep the Vite proxy on `/api` or set `VITE_API_BASE_URL` to the deployed API origin. The adapter expects JSON response bodies matching the shared types in `frontend/src/lib/types.ts` and these routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/dashboard` | Learner dashboard and topic summaries |
| `PATCH` | `/api/learner/weekly-goal` | Save the learner's weekly practice goal (`{ weeklyGoalMinutes }`) |
| `GET` | `/api/topics/{topic_id}` | Sources, context, plan nodes, and questions |
| `POST` | `/api/topics/sources` | Create a topic from an uploaded source (`multipart/form-data`, `file`) |
| `POST` | `/api/topics/{topic_id}/sources` | Add source material to a topic |
| `PATCH` / `DELETE` | `/api/topics/{topic_id}/sources/{source_id}` | Rename or remove a source |
| `POST` | `/api/topics/{topic_id}/scope/stream` | Accept AI SDK UI messages, process the learner’s goal, persist the updated plan, and stream the assistant reply as `text/plain` |
| `PATCH` | `/api/topics/{topic_id}/context` | Save editable learner context |
| `POST` | `/api/questions/answer` | Evaluate an answer and return feedback, evidence, and a next-step recommendation |
| `PATCH` | `/api/questions/{question_id}/difficulty` | Save Lea's too-easy / about-right / too-hard rating |
| `POST` | `/api/tutor/stream` | Accept AI SDK UI messages plus `questionId`; stream the tutor reply as `text/plain` |

The two AI stream routes use the AI SDK text stream protocol: stream UTF-8 assistant text in the response body with `Content-Type: text/plain; charset=utf-8`. Their request bodies contain a `messages` array of AI SDK UI messages (`id`, `role`, `parts`) and the related `topicId` or `questionId`. The plan route should save its generated plan before completing the stream; the frontend then reloads that topic. Other JSON requests use a 15-second client timeout, and the UI provides pending, retry, and failure states. Avoid placing provider secrets in `VITE_*` variables; they are bundled into browser code.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Vite proxies `/api` requests to the FastAPI server on port 8000. The current backend only has a health endpoint; implement the route table above and replace the local Lea fixtures and scripted answers with persistent data and agent logic as the backend takes shape.

## Shared team skill

The reusable `grill-me` skill is in [`skills/grill-me/SKILL.md`](skills/grill-me/SKILL.md). Each team member can install the shared copy in their Codex skills directory:

```bash
mkdir -p ~/.codex/skills/grill-me
cp skills/grill-me/SKILL.md skills/grill-me/LICENSE ~/.codex/skills/grill-me/
```
