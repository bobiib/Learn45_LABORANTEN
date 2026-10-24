# Learn45 Learning Agent

Hackathon prototype for an adaptive learning journey: solo practice, AI coaching, and learning with peers. The briefs prioritize a visible learning loop, a reasoned next-step recommendation, and evidence that the learner can apply feedback.

## Stack

- React + Vite + TypeScript for the prototype UI
- Tailwind CSS for styling
- `@xyflow/react` for the visible learning journey
- shadcn/ui source components, Tailwind theme tokens, and shared interaction states
- Vercel AI SDK UI (`useChat` with `TextStreamChatTransport`) for streamed tutor and plan conversations
- Python + FastAPI, SQLModel/SQLite, and Google's Gemini API for the learning service

The AI SDK UI runs in React and FastAPI remains the backend. The tutor and first-use goal chat use the AI SDK text stream protocol, which FastAPI returns directly; a separate Node server is not required. Gemini calls run only on the backend. The topic-page learning partner uses a regular structured model call to draft edits, then the application validates and applies them only after learner confirmation; it does not run a tool-using agent loop.

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

The demo uses seeded data and loading delays so the frontend can be worked on before the API is available. In demo mode, mock state is stored in browser `localStorage`. In backend mode, SQLite stores topics and learning records under `backend/data/`, and original uploads plus extracted text are kept locally there. Chat transcripts are not saved. Relevant source excerpts, setup goals, answers, and current tutor messages are sent to Gemini for plan generation or tutoring.

Before each backend AI action, Lea shows a confirmation dialog describing what will be sent. The scripted demo does not show this dialog because it makes no external AI request.

### Gemini API key

Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey). Copy `backend/.env.example` to `backend/.env`, then add the key there:

```dotenv
GEMINI_API_KEY=your-secret-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

`backend/.env` and `backend/data/` are ignored by Git. Never put the key in `frontend/.env.local`, a `VITE_*` variable, source code, or a commit. If a key is exposed, revoke it and create another one. Restart the backend after changing this file.

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
| `POST` | `/api/topics/{topic_id}/scope/stream` | First-use only: accept the learner's goal, generate and persist the initial plan from the extracted notes, then stream a ready message as `text/plain`. |
| `POST` | `/api/topics/{topic_id}/conversation/propose` | Use the conversation and current topic to return a structured proposal to edit, add, or delete plan items without saving it. |
| `POST` | `/api/topics/{topic_id}/conversation/apply` | Validate and apply a previously reviewed proposal if its topic version is still current; protects questions with attempts and nodes with progress. |
| `PATCH` | `/api/topics/{topic_id}/context` | Save editable learner context |
| `POST` | `/api/questions/answer` | Evaluate an answer and return feedback, evidence, and a next-step recommendation |
| `POST` | `/api/topics/{topic_id}/recommendation` | Recommend a question using attempt history and current learning-step progress; generate and save a source-grounded question when the learner needs more practice and the queue has no suitable unused question |
| `PATCH` | `/api/questions/{question_id}/difficulty` | Save Lea's too-easy / about-right / too-hard rating |
| `POST` | `/api/tutor/stream` | Accept AI SDK UI messages plus `questionId`; stream the tutor reply as `text/plain` |

The two AI stream routes accept the AI SDK UI `messages` array and stream UTF-8 assistant text with `Content-Type: text/plain; charset=utf-8`. The setup route saves the plan before completing the stream; the frontend reloads that topic. Tutor and plan-chat transcripts are not persisted in Lea. Each Gemini call is stateless and receives only the current request's relevant context. Topic proposals are validated against the current plan version when applied, so a stale proposal must be regenerated. Answer review, upload/OCR, and AI operations can take longer than ordinary data requests.

Generated practice questions and answer feedback may include source references. The backend verifies each quoted excerpt against the named uploaded source before returning it. Adaptive practice uses saved attempt outcomes, difficulty ratings, and learning-step progress; learners can stop the practice chain by returning to the topic plan.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

On Debian or Ubuntu, install OCR support with `sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu`. Scanned PDFs need this system package in addition to the Python packages above. Legacy `.doc` and `.ppt` files can be converted when LibreOffice is installed; `.docx` and `.pptx` do not need it.

Then copy `frontend/.env.example` to `frontend/.env.local`, set `VITE_DEMO_MODE=false`, and run the frontend as above. Vite proxies `/api` requests to FastAPI on port 8000. The backend initializes its SQLite database and uploads directory on first start.

To reset all backend development data, run this from the repository root:

```bash
python reset_db.py
```

The command asks you to type `RESET`, then deletes and recreates the local SQLite database with the starter learner and clears uploaded source files. This removes topics, plans, questions, attempts, learner settings, extracted source text, and uploaded originals. Use `python reset_db.py --yes` to skip the prompt. It refuses non-SQLite databases and data paths outside `backend/data/`.

## Shared team skill

The reusable `grill-me` skill is in [`skills/grill-me/SKILL.md`](skills/grill-me/SKILL.md). Each team member can install the shared copy in their Codex skills directory:

```bash
mkdir -p ~/.codex/skills/grill-me
cp skills/grill-me/SKILL.md skills/grill-me/LICENSE ~/.codex/skills/grill-me/
```

The learning behavior is also available as [`skills/learning-habits-coach/SKILL.md`](skills/learning-habits-coach/SKILL.md). The backend uses the same learning principles in its API prompts; installing the Codex skill makes them available when Codex itself helps with study sessions:

```bash
mkdir -p ~/.codex/skills/learning-habits-coach
cp -R skills/learning-habits-coach/* ~/.codex/skills/learning-habits-coach/
```
