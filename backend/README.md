# Backend (NestJS) - Meeting Scheduler with embedded LangGraph Agent

## Setup
1. Install dependencies:
   - `cd backend`
   - `npm install` or `pnpm install`

2. Environment (.env):
   - Create `backend/.env` with:
     ```
     AZURE_CLIENT_ID=...
     AZURE_TENANT_ID=...
     AZURE_CLIENT_SECRET=...
     AZURE_SCOPE=https://graph.microsoft.com/.default
     REDIS_URL=redis://localhost:6379   # optional

     # LLM provider (for agent)
     LLM_PROVIDER=openai
     OPENAI_API_KEY=sk-...
     OPENAI_MODEL=gpt-4o-mini

     # or for Anthropics:
     # LLM_PROVIDER=anthropic
     # ANTHROPIC_API_KEY=...
     # ANTHROPIC_MODEL=claude-3-sonnet
     ```
3. Initialize Prisma (SQLite):
   - `cd backend`
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`

4. Run:
   - `npm run start:dev`

The agent lives in `backend/src/agent` and is injectable via NestJS DI (AgentModule -> AgentService).
