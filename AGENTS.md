# AGENTS.md — AgentHQ Operating Rules

This repository is public. Work carefully, document decisions, and leave a clean audit trail.

## Production safety

- Do not push directly to `main` without explicit human review.
- Do not deploy unreviewed changes to a live instance.
- Prefer local verification before marking work complete.
- Treat Supabase service-role keys, gateway tokens, and generated passwords as secrets. Never hardcode them into tracked files.
- Keep environment-specific values in `.env.local` or process environment variables, not in source.

## Timeline logging

- Significant operational actions should be reflected in `timeline_events`.
- The observer logs agent/session state changes automatically.
- The dispatcher logs task assignment events automatically.
- Manual maintenance work should be logged when it affects team visibility, task routing, or production operations.

## Task board conventions

The `tasks` table / Task Board is the source of truth.

- `todo` — queued and ready for dispatch
- `in-progress` — actively being worked by exactly one agent
- `review` — implementation finished, waiting on human or QA review
- `done` — verified and complete
- Archive only completed or explicitly cancelled work

Conventions:
- One active task per agent at a time
- Update task status promptly when work moves stages
- Keep `project`, `phase`, `priority`, and `description` specific enough for dispatching and audit history
- Avoid duplicate tasks for the same agent/project/phase combination

## Dispatcher and observer docs

- Dashboard setup and operating notes: `README.md`
- OpenClaw install skill: `../skills/agenthq/SKILL.md`
- Automatic task routing service: `dispatcher.py`
- Automatic agent/session detection service: `observer.py`

## When changing this repo

- Prefer small, reviewable commits.
- Add or update tests when behavior changes.
- Verify both dashboard docs and skill docs when install or runtime requirements change.
