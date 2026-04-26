#!/bin/bash
set -e

echo "Starting KRYPTOS..."

# Check .env exists
if [ ! -f .env ]; then
  echo "Error: .env file not found"
  echo "Copy .env.example to .env and fill in your keys"
  exit 1
fi

# Check required env vars (load .env if not set)
required_vars=("IMGUR_CLIENT_ID" "GITHUB_TOKEN")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    source .env
  fi
  if [ -z "${!var}" ]; then
    echo "Error: $var is not set in .env"
    exit 1
  fi
done

# Build and start
docker compose up --build -d

echo ""
echo "KRYPTOS is running"
echo "Open http://localhost:3000"
echo "Enter the Konami code to access the interface"
echo ""
echo "To stop: ./scripts/stop.sh"
echo "To view logs: docker compose logs -f"
