#!/bin/bash
# MGtranslate Development Script
# Starts all services in development mode

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "
╔═══════════════════════════════════════════════════════════════╗
║          MGtranslate - Development Mode                       ║
╚═══════════════════════════════════════════════════════════════╝
"

# Kill existing processes on our ports
echo "Cleaning up existing processes..."
pkill -f "node.*orchestrator" 2>/dev/null || true
pkill -f "node.*meet-bot" 2>/dev/null || true
pkill -f "python.*integration" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

# Start Orchestrator
echo "Starting Orchestrator on :3001..."
cd "$PROJECT_ROOT/services/orchestrator"
node src/index.js &
ORCH_PID=$!
sleep 2

# Start Meet Bot
echo "Starting Meet Bot..."
cd "$PROJECT_ROOT/services/meet-bot"
node src/index.js &
BOT_PID=$!
sleep 1

# Start Integration Service (if venv exists)
if [ -d "$PROJECT_ROOT/services/integration/.venv" ]; then
    echo "Starting Integration Service..."
    cd "$PROJECT_ROOT/services/integration"
    source .venv/bin/activate
    python src/main.py &
    INT_PID=$!
fi

# Start UI
echo "Starting UI on :3000..."
cd "$PROJECT_ROOT/services/ui"
npm run dev &
UI_PID=$!

echo "
╔═══════════════════════════════════════════════════════════════╗
║  All services started!                                        ║
╠═══════════════════════════════════════════════════════════════╣
║  UI:          http://localhost:3000                           ║
║  Orchestrator: http://localhost:3001                          ║
║  WebSocket:    ws://localhost:3001/ws                         ║
╚═══════════════════════════════════════════════════════════════╝

Press Ctrl+C to stop all services...
"

# Wait and cleanup on exit
cleanup() {
    echo "Stopping services..."
    kill $ORCH_PID $BOT_PID $UI_PID $INT_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

wait
