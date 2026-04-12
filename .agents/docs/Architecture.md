# Architecture — LiveConnect Proxy

## Overview

The system processes messaging through a proxy using a webhook-based flow.

It is composed of:

- Router (entry point)
- Agents (decision layer)
- Skills (execution layer)
- Memory (state persistence)

---

## Core Flow

Input → Router → Agent → Skills → Memory → Response

---

## Inputs

The system can receive:

- Webhook events (incoming messages)
- API requests (sendMessage, sendFile, etc.)
- UI actions (Inbox interactions)

---

## Components

### Router

- Entry point of the system
- Receives all requests
- Classifies request type
- Routes to the correct agent

Rules:
- No business logic
- No data transformation
- Fast execution

---

### Agents

- Decide what action to perform
- Orchestrate skills
- Handle errors

Examples:

- WebhookProcessor
- SendMessageAgent
- ConfigurationAgent
- ErrorHandler

---

### Skills

- Atomic operations
- Stateless
- Reusable
- Input/Output defined

Examples:

- parse payload
- validate message
- store message
- send to provider
- log event

Rules:
- No internal state
- No side effects outside scope
- Always return structured output

---

### Memory

#### Short-Term (Cache)
- Tokens
- Temporary state
- Rate limits

#### Long-Term (Database)
- Conversations
- Messages
- Files
- Logs

---

## Execution Flow

1. Receive input
2. Router classifies request
3. Agent is selected
4. Agent executes required skills
5. Data is stored
6. Response is returned

---

## Message Types

- Text
- File (URL-based)
- Quick Answer

---

## Execution Rules

- Always route before processing
- Use skills for all operations
- Do not implement logic inside agents if a skill exists
- Keep execution minimal and deterministic

---

## Patterns

### Sequential

parse → validate → store

### Conditional

if valid → process
else → error

### Parallel
- Independent tasks can run simultaneously

---

## Error Handling

- Fail fast on invalid input
- Retry on temporary failures (timeout / 5xx)
- Do not retry on client errors (4xx)

---

## Performance Guidelines

- Keep webhook response under 2 seconds
- Minimize number of steps
- Avoid unnecessary processing
- Use only required skills

---

## Design Principles

- Stateless execution
- Separation of concerns
- Skill-based architecture
- Minimal reasoning
- Deterministic behavior

---

## References

See:

- Architecture-Deep.md (full system design)
- RuntimeFlow.md (execution details)
- Skills/ (available actions)