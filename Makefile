.DEFAULT_GOAL := help
.PHONY: help install dev demo api-key reset build lint

help: ## Show the available commands
	@echo "Lea / Learn45 — available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-9s %s\n", $$1, $$2}'

install: ## Install frontend (npm) and backend (Python) dependencies
	@./scripts/install.sh

dev: ## Start the full app with AI features (asks for a Gemini key on first run)
	@./start.sh

demo: ## Start only the frontend with scripted demo data (no API key needed)
	@[ -x frontend/node_modules/.bin/vite ] || ./scripts/install.sh frontend
	@echo ""
	@echo "  ➜ Open http://localhost:5173 in your browser. Press Ctrl+C to stop."
	@echo ""
	@cd frontend && VITE_DEMO_MODE=true npm run dev -- --host 127.0.0.1 --port 5173 --strictPort

api-key: ## Save or change the Gemini API key in backend/.env
	@./scripts/set-api-key.sh

reset: ## Delete all local backend data (topics, uploads, progress)
	@python3 reset_db.py

build: ## Type-check and build the frontend for production
	@cd frontend && npm run build

lint: ## Lint the frontend
	@cd frontend && npm run lint
