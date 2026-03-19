#!/usr/bin/env bash
set -e
echo "pull 代码..."
git pull
echo "build frontend..."
npm run build
echo "build docker..."
docker compose build
