# Learn45 Learning Agent

Hackathon prototype for an adaptive learning journey: solo practice, AI coaching, and learning with peers. The briefs prioritize a visible learning loop, a reasoned next-step recommendation, and evidence that the learner can apply feedback.

## Stack

- React + Vite + TypeScript for the prototype UI
- Tailwind CSS for styling
- `@xyflow/react` for the visible learning journey
- Shared theme tokens and a guarded Button component for consistent UI states
- Vercel AI SDK React UI (`ai`, `@ai-sdk/react`) for AI interactions
- Python + FastAPI for the learning-agent API and model orchestration

The AI SDK runs in the browser for its React UI, while FastAPI remains the backend. AI SDK UI supports compatible text or UI message streams from a Python/FastAPI endpoint, so a separate Node server is not required. Add a model provider in the backend when the team chooses one.

## Start locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Use `npm run lint` to catch raw buttons that bypass the shared interaction styles.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Vite proxies `/api` requests to the FastAPI server on port 8000. The initial UI is a small Lea scenario stub; replace its feedback rule with the agent logic and connect the AI coaching interaction as the demo takes shape.

## Shared team skill

The reusable `grill-me` skill is in [`skills/grill-me/SKILL.md`](skills/grill-me/SKILL.md). Each team member can install the shared copy in their Codex skills directory:

```bash
mkdir -p ~/.codex/skills/grill-me
cp skills/grill-me/SKILL.md skills/grill-me/LICENSE ~/.codex/skills/grill-me/
```
