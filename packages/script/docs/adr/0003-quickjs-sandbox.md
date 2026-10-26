# ADR-0003: QuickJS-WASM inside a Web Worker

- Status: Accepted
- Date: 2026-10-26

## Context

User scripts are untrusted code running in a customer's browser. A bug or a malicious
script must not reach the DOM, the network, storage, or the main thread. A tight loop must
be stoppable.

## Decision

Execute scripts inside QuickJS compiled to WASM, hosted in a Web Worker. QuickJS provides
true realm isolation, an instruction-level interrupt, and a memory cap. The worker keeps
the UI thread free. Imports are resolved only against the virtual `@wicklib/script` module.

## Consequences

- Infinite loops and memory bombs are terminated deterministically.
- Roughly 1–2 MB of WASM is added, which is why the script package is opt-in.
- The runtime is an interpreter and therefore slower than native JS; hot built-ins are
  native and vectorized.
- A message protocol and cancellation semantics must be specified.
- No async, no timers, no I/O inside scripts by construction.

## Alternatives rejected

- Raw JavaScript in a Worker: `fetch` and friends still exist, and a tight loop can only be
  killed by terminating the worker, losing all state and deterministic error reporting.
- Sandboxed iframe: weaker isolation guarantees, awkward messaging, no instruction budget.
- Server-only execution: breaks offline charts and turns every edit into a round trip.
