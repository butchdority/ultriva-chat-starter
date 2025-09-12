# Ultriva Project Chat Starter (Next.js + Webhook)

Minimal web app that fronts the OpenAI Responses API and exposes a webhook endpoint.
Use it to let others interact with your Ultriva project securely via a browser.

## Features
- Next.js App Router
- API routes: `/api/session`, `/api/message`, `/api/webhook`
- Simple chat UI (streaming via Server-Sent Events)
- Webhook verification stub
- No DB required for first run

## Quick start
1. `cp .env.example .env.local` and set `OPENAI_API_KEY`.
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000

## Notes
- This is a starter. Replace verification logic and add persistence as needed.
- If you want per-user threads, persist `thread_id` in your DB keyed by your user id.
-Had to add the env vars again