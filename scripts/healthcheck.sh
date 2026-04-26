#!/bin/bash
echo "Checking KRYPTOS health..."

# Check all containers running
services=("kryptos-frontend" "kryptos-backend" "kryptos-redis")
for service in "${services[@]}"; do
  status=$(docker inspect --format='{{.State.Health.Status}}' $service 2>/dev/null || echo "not found")
  echo "$service: $status"
done

# Check API health endpoint
echo ""
echo "API health:"
curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/health
