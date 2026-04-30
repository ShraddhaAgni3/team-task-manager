@echo off
IF NOT EXIST .env copy .env.example .env
npm install
npm run seed
npm run dev
