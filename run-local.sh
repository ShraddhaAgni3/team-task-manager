#!/usr/bin/env sh
set -e
if [ ! -f .env ]; then
  cp .env.example .env
fi
npm install
npm run seed
npm run dev
