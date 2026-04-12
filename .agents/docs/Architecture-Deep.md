# Architecture (Deep) — LiveConnect Proxy System

## Overview

This system implements a messaging proxy over LiveConnect, designed to:

- Intercept and process messages via webhook
- Enable custom business logic
- Provide a custom Inbox UI
- Persist conversations and messages
- Integrate with external systems (APIs, AI, CRM)

The architecture follows a layered approach with clear separation of concerns.

---

## High-Level Flow

Channel → LiveConnect Proxy → Webhook → Backend → Database → API → Frontend

---

## System Layers

### 1. Entry Layer

Handles all incoming interactions:

- Webhook (incoming messages)
- API calls (sendMessage, sendFile, etc.)
- UI actions (Inbox)

Entry point:
- Flask (`App.py`)

---

### 2. Routing Layer

Responsible for exposing endpoints and delegating logic.

Key responsibilities:

- Define HTTP routes
- Validate basic request structure
- Delegate processing to services
- Proxy requests to LiveConnect API

Rules:

- No business logic
- No data persistence
- Keep endpoints lightweight

---

### 3. Service Layer

Core processing logic of the system.

Main component:
- `webhook_service.py`

Responsibilities:

- Parse incoming payloads
- Normalize message structure
- Extract:
  - text (`message.texto`)
  - file (`message.file`)
  - contact (`contact_data.name`)
- Build final message format
- Handle empty messages
- Call repository for persistence

---

### 4. Repository Layer

Handles all database operations.

Main component:
- `SQLiteRepository`

Responsibilities:

- Insert messages
- Upsert conversations
- Retrieve messages/history
- Maintain ordering consistency

Design:

- Centralized DB access
- Abstracted from services
- Testable and replaceable

---

### 5. Persistence Layer

Current implementation:

- SQLite (local)

Stores:

- Conversations
- Messages
- Files (metadata)
- Basic audit information

Future-ready:

- Can be replaced with PostgreSQL
- Supports scaling if abstracted properly

---

### 6. Integration Layer (LiveConnect)

Located in:
- `metodos/`

Responsibilities:

- Communicate with LiveConnect API
- Manage token (`PageGearToken`)
- Execute operations:

  - sendMessage
  - sendFile
  - sendQuickAnswer
  - transfer
  - setWebhook
  - getWebhook
  - balance

Pattern:

- Thin wrappers over HTTP requests
- Centralized token handling

---

### 7. Frontend Layer (Inbox UI)

Components:

- `index.html`
- `main.js`

Responsibilities:

- Display conversations
- Render messages (text / file)
- Handle user actions
- Call backend endpoints

Key features:

- Message rendering (including files)
- Image preview modal
- Action buttons (send, transfer, quick answer)
- Polling for updates

---

## Message Processing

### Incoming (Webhook)

1. LiveConnect sends webhook
2. Flask receives `/webhook/liveconnect`
3. Service processes payload:
   - Extract text / file / contact
   - Normalize structure
4. Message is persisted
5. Conversation updated

---

### Outgoing (Agent/UI)

1. UI triggers action (sendMessage, sendFile, etc.)
2. Backend receives request
3. Calls LiveConnect API
4. On success:
   - Message stored locally (sender = agent)
5. UI updates

---

## Message Model

### Text Message

```json id="p38kxb"
{
  "message": "Hola",
  "sender": "usuario|agent"
}
```