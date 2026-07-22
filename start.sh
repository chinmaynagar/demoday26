#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Demo Day Leaderboard..."

# ── Backend ──────────────────────────────────────────────────────────────────
UVICORN="$(python3 -m site --user-base)/bin/uvicorn"
if [ ! -f "$UVICORN" ]; then
  UVICORN="uvicorn"
fi

cd "$ROOT/backend"
DATA_SOURCE="${DATA_SOURCE:-local_csv}" \
  "$UVICORN" main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend  → http://localhost:8000  (pid $BACKEND_PID)"

# ── Frontend ─────────────────────────────────────────────────────────────────
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
echo "  Frontend → http://localhost:5173  (pid $FRONTEND_PID)"

echo ""
echo "Press Ctrl+C to stop both servers."

# ── Cleanup on exit ───────────────────────────────────────────────────────────
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait" INT TERM

wait
