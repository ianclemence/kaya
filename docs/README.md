# Kaya

Kaya is a personal AI that lives on hardware you own. Underneath, it is a
runtime: it gives a language model identity, memory, authority, capabilities,
execution, evidence, and durable behavior, then keeps those things trustworthy
even when the model is wrong.

This directory explains how that works. It describes what Kaya actually does
today, and is written for engineers and architects who need to understand where
authority lives and why the boundaries are drawn where they are. If you just want
to use Kaya, start with [Using Kaya](GUIDE.md).

It holds this README and the nine documents linked at the end (one per layer of
the chain below). Beside them are the guides for the person
running Kaya: [Using Kaya](GUIDE.md),
[What a Pod needs](HARDWARE.md),
[Your Pod, from the box to your first conversation](POD-QUICKSTART.md),
[Reaching your Kaya when you are away](CONNECT.md) (the relay decision record),
and [Commands and configuration](COMMANDS.md); and for people building on it,
[Developing Kaya](DEVELOPMENT.md) and
[The Kaya app and the gateway API](MOBILE-API.md). Nothing else lives here.

---

## What Kaya Is

Kaya is **not** a model. Kaya is the runtime around a model.

A model can reason, plan, and propose. A model cannot be trusted to decide what
it is allowed to do, whether it actually did something, or what should be
remembered forever. Kaya owns those responsibilities.

Kaya owns:

- **identity** — one persistent Kaya with a durable relationship to its owner;
- **authority** — a single Permission Broker that decides what may happen;
- **execution semantics** — how authorized work is actually carried out;
- **evidence** — runtime proof that work happened;
- **canonical events** — the durable record of what Kaya did;
- **memory semantics** — what is remembered, and under what boundaries;
- **routines and artifacts** — persistent behavior and durable outputs.

Models are replaceable. Kaya's trust semantics are not.

> Everything that varies is replaceable. Everything that defines trust is
> owned by Kaya.

---

## The Core Architecture

```
USER
  ↓
KAYA
  ↓
INTENT / REASONING
  ↓
CAPABILITY
  ↓
PERMISSION BROKER
  ↓
EXECUTION
  ↓
EVIDENCE
  ↓
CANONICAL EVENT
  ↓
MEMORY / ACTIVITY / ROUTINES / ARTIFACTS
```

A user expresses a goal. Kaya interprets it. Kaya selects a capability.
The Permission Broker decides whether Kaya may proceed. Execution performs
the authorized work. Evidence proves what actually happened. A canonical event
records it. Downstream systems — memory, activity, routines, artifacts —
consume that record.

---

## The Core Idea

Most agent architectures look like this:

```
MODEL → arbitrary tool → machine
```

Kaya deliberately does not work that way.

In Kaya, the model participates in reasoning, but it does not hold authority,
does not directly control the machine, and cannot declare its own success.
Every consequential action crosses the Permission Broker, and every
consequential success must be supported by runtime evidence.

This is the difference between "an LLM with tools" and "a runtime that gives
an AI trustworthy abilities."

---

## Trust Model

Kaya's trust model rests on a small number of invariants:

1. **One authority.** The Permission Broker is the sole authority for
   consequential actions. Nothing else may grant authority.
2. **Availability is not authority.** A capability being usable does not mean
   it is authorized.
3. **Authentication is not authorization.** A connected app having valid
   credentials does not mean Kaya may use them for a given operation.
4. **Implementation is not authority.** Providers, integrations, MCP servers,
   and tools execute; they do not decide.
5. **A model claim is not evidence.** The runtime, not the model, determines
   whether an action happened.
6. **Fail closed.** Unknown risk, malformed requests, and missing boundaries
   result in "ask" or "deny", never silent allow.

---

## The Layers

| Layer | Responsibility | Primary package |
|---|---|---|
| User | Expresses goals, approvals, corrections | — |
| Kaya | Owns identity, authority, orchestration, persistence | `pkg/kaya`, `pkg/agent` |
| Intent / Reasoning | Interprets requests, plans, requests capabilities | `pkg/agent` |
| Capability | Stable semantic ability + resolver | `pkg/capability` |
| Permission Broker | Authoritative allow / ask / deny | `pkg/permissions` |
| Execution | Performs authorized work via implementations | `pkg/tools`, `pkg/providers`, `pkg/browser`, `pkg/computer`, `pkg/mcp` |
| Evidence | Runtime proof of what executed | `pkg/capability`, `pkg/tools` |
| Canonical Event | Durable runtime-owned record | `pkg/cevents` |
| Memory / Activity / Routines / Artifacts | Downstream behavior and outputs | `pkg/personalcontext`, `pkg/rag`, `pkg/activity`, `pkg/routinefeed`, `pkg/routines`, `pkg/scheduled`, `pkg/artifacts` |

Supporting subsystems: `pkg/connectedapp` (authenticated external systems),
`pkg/credentials` (the credential boundary), `pkg/live` (browser/computer
surfaces), `pkg/skills` (knowledge and procedures), `pkg/infer` (capability-based
inference contract), `pkg/desk` (the read-only projection of the
artifacts Kaya makes for the owner), `pkg/proactive` (proactive policy and
the owner-facing status of Kaya's quiet work), `pkg/connector` (portable,
signed connector manifests and their governed execution).

---

## Architectural Boundaries

Kaya keeps a small number of firm boundaries:

- **One permission authority.** `pkg/permissions` holds the only Broker.
- **One scheduler authority.** `pkg/scheduled` is the active scheduler. The
  retired JSON cron engine (`pkg/cron`) no longer exists. Owner surfaces read
  the unified feed from `pkg/routinefeed` (`GET /v1/routinefeed`), which normalizes
  routines and scheduled items without owning storage or scheduling.
- **One credential authority.** `pkg/credentials.Vault` owns credential
  lifecycle. No other package reads or writes credential storage directly.
- **One canonical event authority.** `pkg/cevents` owns the durable event
  stream.
- **Bounded semantic model surface.** The model sees a small set of semantic
  tools (for example `calendar`, `device`, `message`, `weather_now`,
  `browser_*`, `computer_*`). There is no generic `execute(capability, args)`
  escape hatch.

---

## Key Distinctions

| This | Is not |
|---|---|
| AVAILABLE | AUTHORIZED |
| AUTHENTICATED | AUTHORIZED |
| IMPLEMENTATION | AUTHORITY |
| TOOL | CAPABILITY |
| MODEL CLAIM | EVIDENCE |
| SKILL | AUTHORITY |
| CONNECTED APP | PERMISSION |
| RESOLVER | AUTHORITY |

These distinctions are developed in the layer documents below.

---

## Where To Read Next

Read in order for a full picture, or jump to the layer you need.

- [User](USER.md)
- [Kaya](KAYA.md)
- [Intent & Reasoning](INTENT-REASONING.md)
- [Capability](CAPABILITY.md)
- [Permission Broker](PERMISSION-BROKER.md)
- [Execution](EXECUTION.md)
- [Evidence](EVIDENCE.md)
- [Canonical Events](CANONICAL-EVENT.md)
- [Memory, Activity, Routines & Artifacts](MEMORY-ACTIVITY-ROUTINES-ARTIFACTS.md)
