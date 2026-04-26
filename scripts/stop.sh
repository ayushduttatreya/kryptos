#!/bin/bash
echo "Stopping KRYPTOS..."
docker compose down
echo "Stopped. Redis data persisted in volume kryptos-redis-data"
echo "To also remove data: docker compose down -v"
