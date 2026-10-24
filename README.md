# Learn45 Learning Agent

Hackathon prototype for an adaptive learning journey: solo practice, AI coaching, and learning with peers. The briefs prioritize a visible learning loop, a reasoned next-step recommendation, and evidence that the learner can apply feedback.

**Quick start:** run `make dev`, then open <http://localhost:5173>. New to this? Follow the [step-by-step guide](#getting-started-step-by-step) below.

## Stack

- React + Vite + TypeScript for the prototype UI
- Tailwind CSS for styling
- `@xyflow/react` for the visible learning journey
- shadcn/ui source components, Tailwind theme tokens, and shared interaction states
- Vercel AI SDK UI (`useChat` with `TextStreamChatTransport`) for streamed tutor and plan conversations
- Python + FastAPI, SQLModel/SQLite, and Google's Gemini API for the learning service

The AI SDK UI runs in React and FastAPI remains the backend. The tutor and first-use goal chat use the AI SDK text stream protocol, which FastAPI returns directly; a separate Node server is not required. Gemini calls run only on the backend. The topic-page learning partner uses a regular structured model call to draft edits, then the application validates and applies them only after learner confirmation; it does not run a tool-using agent loop.

The shared shadcn/ui components live in `frontend/src/components/ui/` and are configured by `frontend/components.json`. The project uses the Base UI-backed shadcn style for Tailwind v4. Extend these shared components instead of adding screen-specific controls.

## Getting started (step by step)

You type a few commands into a **terminal**, the text window where you give your computer commands. Open it like this:

- **macOS:** press `Cmd + Space`, type "Terminal", and press Enter.
- **Windows:** open *PowerShell* as administrator, run `wsl --install`, restart, then open the *Ubuntu* app from the Start menu. Run everything below in that window and follow the Linux steps.
- **Linux:** open your *Terminal* app.

### 1. Install the tools (one time only)

- **macOS:** run `xcode-select --install`, then install [Node.js](https://nodejs.org) (LTS) and [Python](https://www.python.org/downloads/).
- **Linux / Windows (WSL):** run `sudo apt update && sudo apt install -y git make python3 python3-venv python3-pip`, then install [Node.js](https://nodejs.org/en/download) (LTS).

### 2. Download and start the app

```bash
git clone https://github.com/bobiib/Learn45_LABORANTEN.git
cd Learn45_LABORANTEN
make dev
```

On the first start, the app installs what it needs (this takes a few minutes) and asks for a **Gemini API key**:

1. Open [Google AI Studio](https://aistudio.google.com/app/apikey), sign in with a Google account, and click **Create API key**.
2. Copy the key, paste it into the terminal, and press Enter. The key stays hidden while you paste it.

The key is saved only on your computer, in `backend/.env`. It is never uploaded.

### 3. Open the app

When the terminal shows `➜ Open http://localhost:5173 in your browser`, open **<http://localhost:5173>**.

To stop the app, press `Ctrl + C` in the terminal. To start it again later, open a terminal in the `Learn45_LABORANTEN` folder and run `make dev`.

### What to try in the app

1. **Create a topic:** on the dashboard, upload your learning notes (PDF, Word, PowerPoint, or text file).
2. **Set your goal:** tell the AI coach what you want to focus on. Lea generates a learning plan and practice questions from your notes.
3. **Explore the topic:** see the learning steps and how they build on each other, filter questions, and adjust your learning context.
4. **Practice:** answer a question. If you are stuck, use the step-by-step hints or chat with the tutor.
5. **Get feedback:** see what you got right, what to improve, and a recommended next step based on your progress.

Before Lea sends anything to the AI, it shows a confirmation dialog that explains what will be sent.

### Try it without an API key

To look around without a Gemini key, run:

```bash
make demo
```

and open <http://localhost:5173>. This mode uses example data and scripted AI answers. Nothing is sent to an AI service.

### All commands

| Command | What it does |
| --- | --- |
| `make dev` | Starts the full app with AI features at <http://localhost:5173> (installs dependencies on first run) |
| `make install` | Reinstalls all dependencies (`npm install` and Python packages), for example after pulling updates |
| `make demo` | Starts the app with example data, without AI or an API key |
| `make api-key` | Saves or changes your Gemini API key |
| `make reset` | Deletes all local data (topics, uploads, progress) and starts fresh |
| `make help` | Lists these commands |

### Troubleshooting

| Problem | Solution |
| --- | --- |
| A command prints a version error or `command not found` | Install the missing tool (step 1), open a new terminal, and try again. |
| `Port 5173 (or 8000) is already in use` | The app is probably already running in another terminal window. Press `Ctrl + C` there, or close that window, then run `make dev` again. |
| `Could not create a Python environment` | On Linux or WSL, run `sudo apt install python3-venv`, then run `make dev` again. |
| AI features show an error | Check that your API key is correct: run `make api-key`, paste the key again, and restart with `make dev`. |
| Scanned PDFs are not read | Install text recognition (OCR): on Linux/WSL run `sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu`; on macOS install [Homebrew](https://brew.sh) and run `brew install tesseract tesseract-lang`. |

## Developer reference

The sections below are for developers who want to run or change the services individually.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Use `npm run lint` to catch raw buttons that bypass the shared interaction styles. The frontend starts in scripted demo mode and stores Lea's context and uploaded-source fixtures in this browser. Copy `frontend/.env.example` to `frontend/.env.local` to configure it.

Run `npm run build` to type-check the frontend and create a production build in `frontend/dist/`.

### Frontend flow

- Dashboard: progress, recent session, topic cards, and upload entry point.
- First-use topic setup: choose a notes file, tell the scripted coach what to focus on, then inspect the generated learning plan and questions.
- Topic space: manage source names, inspect the read-only prerequisite graph, filter questions, and edit Lea's learning context.
- Question and review: answer with optional stepped hints or tutor chat, rate difficulty, see qualitative progress evidence, and follow the explained next recommendation.

The demo uses seeded data and loading delays so the frontend can be worked on before the API is available. In demo mode, mock state is stored in browser `localStorage`. In backend mode, SQLite stores topics and learning records under `backend/data/`, and original uploads plus extracted text are kept locally there. Chat transcripts are not saved. Relevant source excerpts, setup goals, answers, and current tutor messages are sent to Gemini for plan generation or tutoring.

Before each backend AI action, Lea shows a confirmation dialog describing what will be sent. The scripted demo does not show this dialog because it makes no external AI request.

### Gemini API key

Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey). Run `make api-key` to save it, or copy `backend/.env.example` to `backend/.env` and add the key there:

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

To reset all backend development data, run `make reset` (or `python3 reset_db.py`) from the repository root.

It asks you to type `RESET`, then deletes and recreates the local SQLite database with the starter learner and clears uploaded source files. This removes topics, plans, questions, attempts, learner settings, extracted source text, and uploaded originals. Use `python3 reset_db.py --yes` to skip the prompt. The command automatically uses `backend/.venv` when present. If backend dependencies are not installed yet, create that environment and install them with `python3 -m venv backend/.venv` and `backend/.venv/bin/python -m pip install -r backend/requirements.txt`. It refuses non-SQLite databases and data paths outside `backend/data/`.

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
