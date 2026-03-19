#!/usr/bin/env bash

set -e

echo "run postgres and redis..."
docker compose up -d postgres redis
echo "run test..."
docker compose --profile test run --rm backend-test
