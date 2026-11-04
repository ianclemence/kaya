# User

The user is the owner and operator of Kaya. Everything Kaya does exists to
serve the user's goals while protecting the user's trust.

## The human as owner

Kaya is a personal runtime, not a shared service. It has one persistent
relationship with its owner. That relationship is durable: identity, memory,
preferences, routines, and artifacts persist across sessions and restarts.

The user is the source of goals and the final authority on intent. The user
expresses what they want; Kaya decides how to accomplish it safely.

## Natural-language interaction

The user interacts with Kaya in ordinary language — through a chat channel,
the Web Console, or a paired device. They do not issue structured commands to
internal machinery.

A paired phone is how the user reaches the Pod; it carries no model of its
own. While the Pod is unreachable the app says so plainly: the last
conversation stays readable and new messages wait in an outbox, going out in
order when the Pod returns. Nothing executes on the phone — routines, home
control, memory, and every action stay on the Pod.

Examples:

| The user says | The user means |
|---|---|
| "Remember that I prefer morning flights." | A durable preference Kaya should honor later |
| "Book me the cheapest reasonable flight tomorrow." | A goal that requires a real external action |
| "Turn off the bedroom light." | A device-control goal |
| "Remind me every Friday." | A recurring routine |
| "Send this to Maria." | An outbound message goal |

In each case the user expresses **intent**, not implementation instructions.
They never choose a provider, a tool, or a capability identifier.

## User goals vs implementation details

The user should not need to know about:

- which model answered;
- which provider or integration was used;
- which capability or tool ran;
- which API or endpoint was called;
- how authentication worked;
- which scheduler fired a routine;
- how evidence was validated.

Those are runtime concerns. This is a deliberate product decision:

> Complexity belongs in the runtime, not in the owner's head.

The user experience is intentionally simple even though the runtime underneath
is sophisticated.

## Approvals

When an action is consequential, Kaya may ask for approval before proceeding.
The user answers in natural language ("yes", "always", or "no"). Kaya's
Permission Broker records the decision and, when the user chooses "always",
stores a scoped standing grant.

The user is never asked to approve something Kaya is not actually going to do,
and never has authority applied on their behalf without a decision.

## Corrections

The user can correct Kaya: change a preference, retract a fact, or tell Kaya
it misunderstood. Corrections update memory and behavior through Kaya's
governed memory system, not through silent overwrites.

## Preferences

Preferences are durable facts about how the user wants Kaya to behave. They
are stored as memory entries with provenance, so Kaya can distinguish a
user-declared preference from an inferred one.

## The persistent relationship

Because Kaya is persistent, the user should experience continuity: Kaya
remembers what matters, honors standing grants within their scope, and can be
taken over or paused on a live surface (browser or computer) when the user
wants direct control.

## How user intent enters Kaya

```
User request (natural language)
        ↓
Kaya receives the message with channel/session context
        ↓
Intent / reasoning interprets it
        ↓
A capability request is formed
        ↓
Governance decides
```

The user's words are input to reasoning. They are not commands to execution.

## What the user should and should not need to know

The user should know:

- what Kaya can help with;
- when Kaya needs approval;
- what Kaya actually did (through activity);
- how to correct or forget something.

The user should not need to know:

- providers, tools, capabilities, or schedulers;
- permission internals or event schemas;
- how credentials are stored;
- model selection or routing.

One deliberate exception: every phone answer says where it ran (on this phone
vs home Pod). Routing disclosure is the user's only window into a distributed
runtime, and hiding it would read as untrustworthy when answers differ in
strength.

## Related concepts

See [Kaya](KAYA.md) for the runtime that owns the relationship, and
[Intent & Reasoning](INTENT-REASONING.md) for how requests become capability
requests.

## Backups and recovery

Kaya saves a recovery snapshot of its memory, files, settings and secrets
before every update, and `kaya state backup` takes one on demand (the newest
five are kept, in the Pod's `backups` folder). Two things to know:

- **A backup on the Pod dies with the Pod.** Copy the newest `.gst` file to
  another computer now and then.
- **A backup can only be opened with the Pod's key.** The key is
  `KAYA_MASTER_KEY` in `.master-env` in the Kaya config directory. Keep a copy
  of it somewhere safe and separate from the backup, such as a password manager.

To restore onto a fresh install of Kaya:

```bash
KAYA_MASTER_KEY=<your key> kaya state import kaya-20260930-081926.gst
```

Memory, conversation history, files and settings come back. Paired phones do not
(re-pair with `kaya pair`), and neither do notification tokens; the app
registers again on its own.
