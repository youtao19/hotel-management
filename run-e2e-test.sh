#!/usr/bin/env bash

docker compose up -d postgres redis
docker compose --profile test run --rm e2e
