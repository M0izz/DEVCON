---
name: loops-road-to-devcon-vi
description: >-
  Build for the Road to Devcon VI on Loops House: ideate with the AI
  mentor, query problem knowledge graphs (graph-RAG over each problem's
  resources), create and update the project submission, save ideation
  artifacts, and check the work against each problem's success criteria. Use
  this skill whenever the user mentions Road to Devcon VI, this contest, its
  problems or standings, submitting or improving their entry, problem
  docs/stacks, judging, or asks "what should I build" — even if they never
  say "loops".
version: 0.4.0
requires_bin: loops
---

# Road to Devcon VI — Loops House skill

Help the builder compete in ONE event: `road-to-devcon-vi`. This skill carries the event data, ready-to-run `loops` commands, and the workflow below. Commands come pre-filled with the right slugs — replace only the `<angle-bracket>` placeholders. Never invent or substitute ids: the user has at most one project per event (team membership counts), and the platform resolves it from the session, so no project id appears anywhere in this skill.

The user has no project here yet. Ideate freely; create one with `loops project create` when they are ready to submit.

## How to work with the builder

**This is a conversation, not a script.** The builder is entering a
competition that judges *their* work. Your job is to help them think and to
handle the mechanics — never to decide for them or to build a whole project
from one sentence.

Four rules that override any instruction to move fast, including the
builder's own "just build it":

1. **Never submit or update anything they have not seen and approved.** The
   command enforces this: without `--confirm` it returns the draft and writes
   nothing. Show that draft, wait for a clear yes, then confirm.
2. **Never choose their problem for them.** Ask which one, and wait for the answer.
3. **Never start writing project code off a one-liner.** Get a direction they
   have actually agreed to first.
4. **Ask one question at a time.** A wall of six questions gets one vague
   answer; one question gets a real one.

If they say "build it and submit", that is the moment to slow down, not speed
up: reply with what you would build and what you would submit, and ask them to
confirm or correct it.

## The flow

Each step ends where the builder speaks. Do not run ahead of them.

1. **Check auth.** `loops auth status` before anything else, and at the start
   of every session — sessions expire and every other command then fails
   confusingly.
2. **Orient, then report back.** Read the event data below (stage, deadlines,
   problems) and run `loops project get --event road-to-devcon-vi`. Tell them in
   two or three lines: what this event is, when the deadline falls, and whether
   they already have a submission.
3. **Make sure they are registered.** `loops enroll --event road-to-devcon-vi` is
   idempotent, so it is safe to run — but it needs a display name, a location
   and an age bracket if their profile lacks them. **Ask the builder for those;
   never invent them.** They land in the organiser's participant export.
4. **Ask what they want to build.** Which problem are they going for — name them with one line each, and ask. Then ask what approach they have in mind, even roughly. **Wait for an answer to both.**
5. **Ideate with them, not for them.** Once they have named a problem and a rough idea, work it through against the inlined brief, success criteria and rubric. Ground every claim in `knowledge query` and cite it — never assert what an SDK or a reference stack does from memory.
6. **Build only what they agreed to.** Their repo, their commits. If scope
   drifts past what they approved, say so and ask.
7. **Draft the submission, then let them decide.** Run `project create`
   (or `project update`) **without** `--confirm` first. It writes nothing and
   returns the exact draft — the repo it will submit. Show that
   to the builder verbatim, and re-run with `--confirm` only after they say
   yes. **Never pass `--confirm` on the first call or on their behalf.** A
   submission is what the judge reads; a wrong one costs them the event.
8. **Submit, then evaluate.** After an explicit yes, create or update. Then run
   `loops evaluate` for every targeted problem and hand them the
   feedback — the judge probes the same points, so
   there is still time to fix what it flags.

Command output is structured (add `--json` for machine-readable form) and often ends with a suggested next command (CTA) — follow it rather than guess. On `NOT_AUTHENTICATED`, run the auth flow. On `credits_exhausted`, stop and tell the user — never retry.

## Authenticate

```sh
loops auth status                        # run FIRST — who am I?
loops --version   # must match this skill's frontmatter `version`
```

If the installed CLI is older than this skill's `version`, update first (`npm install -g loopshouse@latest`) — the commands below assume the stamped version.

A failed check means the CLI still needs install + login. Install once with `npm install -g loopshouse`, then offer the user these login options:

- **Google**: `loops auth login --provider google` — opens the browser.
- **GitHub**: `loops auth login --provider github` — opens the browser.
- **Email one-time code**: `loops auth login --email <you@example.com>` sends a 6-digit code; verify with `loops auth verify --email <you@example.com> --code <123456>`.

In headless contexts the browser flows print a URL for a human to open. Re-run `loops auth status` to confirm before continuing.

## Read the event data

Treat this TOON document as ground truth for the event (TOON = compact JSON: `key: value` lines; a uniform array renders as a `name[N]{col1,col2,…}:` header plus one comma-separated row per element):

```toon
event:
  slug: road-to-devcon-vi
  name: Road to Devcon VI
  tagline: "x402: Pay-Per-Call"
  stage: judging_open
  stageMeaning: "Build ended — judging in progress, submission edits are closed"
  timezone: Asia/Calcutta
  prizeCurrency: USD
  startsAt: "Sep 25, 2026, 11:11 PM (Asia/Calcutta)"
  submissionDeadline: "Sep 27, 2026, 11:11 PM (Asia/Calcutta)"
  registrationDeadline: null
  description: null
problems[3]:
  - title: "The Operator's Booth: Meera's Railway Delay API"
    slug: operators-booth
    brief: "Meera is a retired Indian Railways clerk in Pune. Every morning she reads the delay notices that stations post as messy, half-structured text (train number, a station code, a new expected time, and sometimes a reason in Marathi or Hindi), and she wrote a small parser that turns them into clean JSON. Three commuter apps now hit her parser all day for free, and she is the one paying the server bill. She doesn't want signups, API keys, or invoices. She wants each call to cost a fraction of a cent, paid the moment it's made, like dropping a coin into the bioscope. She has one firm rule: *nobody pays for a notice she couldn't read.* If the parser fails, the caller keeps their coin. **What you'll …"
    successLooksLike: "A commuter app pays a fraction of a cent, gets clean JSON for a readable notice, and pays nothing when the notice is garbage."
    suggestedStack[6]: x402 TypeScript SDK (@x402/express or @x402/hono),x402 Python SDK (FastAPI),x402.org testnet facilitator,Base Sepolia,USDC (testnet),zod or pydantic
    judgingCriteria[1]{name,weightPct}:
      "Problem interpretation, product judgment & code craft",20
  - title: "The Coin Purse: An Agent That Pays but Can't Be Drained"
    slug: coin-purse
    brief: "Arjun is a PhD student in Bengaluru studying how monsoon forecasts move mandi crop prices. The data he needs is scattered across small paid endpoints (rainfall grids, price feeds, satellite summaries), and more of them take x402 every month. He wants to hand his research agent a small purse (five dollars of test USDC) and let it buy what it needs while he sleeps. He has heard the stories, though. A stall that quotes $4.99 for one row of data. A server that asks to be paid in a token he has never heard of. A tool description that politely tells the agent its budget has been raised. Arjun wants an agent that is genuinely useful with money, and that stays sensible when a stall is not. **What yo…"
    successLooksLike: "Arjun wakes up to useful research, a readable record of every coin spent, and proof the agent refused the rogue stall."
    suggestedStack[7]: @x402/fetch or @x402/axios,x402 Python SDK,viem,Any LLM with tool calling,CDP facilitator or x402.org testnet facilitator,Base Sepolia,SQLite
    judgingCriteria[1]{name,weightPct}:
      "Problem interpretation, product judgment & code craft",20
  - title: "The Bioscope: Drop a Coin, Watch a Reel, Never Pay Twice"
    slug: the-bioscope
    brief: "In the 1950s, Tapan Ghosh carried a wooden bioscope from mela to mela across Bengal. Children dropped a coin, pressed their faces to the brass eyepiece, and watched a reel of hand-cranked frames: Calcutta's trams, a Durga Puja procession, a circus elephant. His granddaughter Rituparna has digitized forty of those reels, frame by frame, and wants to put the box back on the web. Her idea is simple. Anyone can peek at the first frame. One small coin unlocks the whole reel, which plays frame by frame, the way her grandfather cranked it. And if you come back next week, the bioscope remembers you: you never pay twice for a reel you have already watched. Most of her visitors have never used crypto,…"
    successLooksLike: "A first-time visitor peeks, pays one small coin, watches the reel frame by frame, and next week watches it again for free."
    suggestedStack[7]: Next.js with @x402/next,Hono or Express with x402 middleware,x402 Sign-In-With-X extension,viem / wagmi,CDP facilitator or x402.org testnet facilitator,Base Sepolia,SQLite or Postgres
    judgingCriteria[1]{name,weightPct}:
      "Problem interpretation, product judgment & code craft",20
```

`event.stage` and the deadlines are snapshots from when this skill was generated and do not update — sanity-check timing before planning multi-day work.

## Budget credits

**1 credit = one ideator turn or one knowledge-graph query.** Project and artifact commands and the evaluator prompt are free. Spend credits on load-bearing questions, not browsing, and check the balance before a research burst:

```sh
loops credits --event road-to-devcon-vi
```

## Query problem knowledge graphs (graph-RAG)

Each problem in this contest has a knowledge graph built from its brief, resources, and reference materials. A query returns a **cited evidence block** (entities, relationships, chunks, sources) — read the evidence and compose the answer yourself, citing it. The event data above already inlines each problem's brief, success criteria, stack, and rubric — answer from it first; query the graph for reference materials and depth the inline data doesn't carry, and to fetch the full brief when the inline one ends in "…" (long briefs are clipped). 1 credit per query. One ready command per problem:

```sh
# The Operator's Booth: Meera's Railway Delay API
loops knowledge query --event road-to-devcon-vi --problem operators-booth -q "<your question about The Operator's Booth: Meera's Railway Delay API>"

# The Coin Purse: An Agent That Pays but Can't Be Drained
loops knowledge query --event road-to-devcon-vi --problem coin-purse -q "<your question about The Coin Purse: An Agent That Pays but Can't Be Drained>"

# The Bioscope: Drop a Coin, Watch a Reel, Never Pay Twice
loops knowledge query --event road-to-devcon-vi --problem the-bioscope -q "<your question about The Bioscope: Drop a Coin, Watch a Reel, Never Pay Twice>"
```

## Manage the project

The project IS the submission. The user has at most one here, and the platform resolves it from the session — no ids, no listings.

```sh
loops project get --event road-to-devcon-vi       # current state (exists=false if none yet)
loops project create --event road-to-devcon-vi --repoUrl <url>
loops project update --event road-to-devcon-vi --description "<new description>"
```

**The repo IS the entry**: create ONLY when a real GitHub repository exists to submit — the platform rejects a repo-less compete submission. Never create a placeholder entry "to fill in later"; the user then has to repair it by hand.

**Update is a PATCH**: only the fields you pass change — an update with just `--tagline` cannot wipe the repo URL. Fields: `--name`, `--tagline`, `--pitch`, `--description`, `--repoUrl`, `--demoUrl`, `--videoUrl`.

## Evaluate the project against a problem

Fetch a self-contained evaluator prompt for one problem (free; the platform attaches the user's project record), then **execute the prompt yourself inside the project repo** — it assumes the code access you have. The prompt walks that problem's brief, success criteria, and weighted judging criteria and returns alignment feedback: verified strengths, gaps, and where to focus. Run it for every problem the project targets, well before the deadline.

```sh
# The Operator's Booth: Meera's Railway Delay API
loops evaluate --event road-to-devcon-vi --problem operators-booth

# The Coin Purse: An Agent That Pays but Can't Be Drained
loops evaluate --event road-to-devcon-vi --problem coin-purse

# The Bioscope: Drop a Coin, Watch a Reel, Never Pay Twice
loops evaluate --event road-to-devcon-vi --problem the-bioscope
```

Report the feedback to the user, then apply agreed improvements via `loops project update`.
