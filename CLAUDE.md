# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UDS Inventory — a web app for managing NGO inventory. Data is stored in Google Sheets, images in Google Drive. See `ARCHITECTURE.md` for detailed diagrams.

## Commands

- **Dev server** (frontend :8080 + backend :3000): `npm run dev`
- **Backend only**: `npm start`
- **Tests**: `npm test` (runs `backend-test/test-sheet.js`)
- Individual test files: `node backend-test/<test-file>.js`

## Architecture

- **Frontend**: Vanilla HTML/JS/CSS in `html/` — single-page app with client-side routing (`/search`, `/i/:id`)
- **Backend**: Node.js HTTP server in `backend/server.js` (no framework, raw `http` module) on port 3000
- **Dev server**: `dev-server.js` serves static files on :8080 and proxies `/inv-api/*` to backend
- **Data layer**: `backend/sheetRepo.js` loads Google Sheet rows into an in-memory cache, handles search/CRUD. `backend/googleSheetService.js` manages Google API auth via service account.
- **Config**: `config.js` holds spreadsheet ID, Drive folder ID, enum values (Holders, Locations, ItemTypes, Categories), and Google OAuth client ID

## Key Conventions

- CommonJS modules (`require`/`module.exports`)
- No build step — frontend files are served as-is
- No framework on frontend or backend — everything is vanilla JS
- Inventory schema defined as `INVENTORY_HEADERS` in `backend/server.js` — this drives row parsing and validation
- Every inventory row is identified by `key` (not `id`) — use `key` in new code, docs, and instructions
- Auth: Google OAuth ID token verified server-side, session stored as cookie
- API routes are prefixed with `/inv-api/` by nginx/dev-server proxy, but backend handles them without prefix
- Avoid comments — use descriptive function/variable/const names and extract logic into well-named functions. Comments are acceptable only in public documentation and complex algorithms.

## Credentials

- `credentials.json` (service account key) must exist at project root — not committed
- Google OAuth Client ID is in `config.js`

## Deployment

Deployed to Raspberry Pi via git push hook. nginx reverse-proxies `/inv-api/*` to the Node backend. pm2 manages the process.
