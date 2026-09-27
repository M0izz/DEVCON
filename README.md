# The Coin Purse

A small x402 research agent with a hard-coded payment boundary, two honest data routes, two hostile quote routes, and an append-only JSONL audit trail. It targets Base Sepolia and the canonical test USDC contract only. The seller datasets are labeled fixtures, not live agricultural observations.

## Spending Boundary

The model can choose a named tool source, but it cannot provide a URL, token, payee, chain, or budget. Before `@x402/fetch` is allowed to create a payment payload, `src/buyer.ts` reads the seller's 402 requirements and calls `decidePayment` in `src/policy.ts`. That policy requires the exact scheme, Base Sepolia (`eip155:84532`), the canonical Base Sepolia USDC contract, the configured trusted payee, an integer atomic amount, a per-call ceiling, and enough remaining run budget. The x402 client's own spend controls apply a second per-payment cap.

The default per-call limit is `250000` atomic units ($0.25); the default run budget is `5000000` ($5). Every arithmetic comparison uses `BigInt`. An accepted quote is reserved before signing, so failures consume budget for the rest of that run rather than creating a retry-based overspend path.

Each decision is appended to `records/run.jsonl` before payment payload creation. Accepted requests get a second `payment_outcome` event after the seller responds; a successful seller response is recorded as `paid`, while transport or settlement errors are marked `failed_or_unconfirmed`. A `paid` event means the x402 fetch completed with an HTTP success after SDK payment handling; retain the seller's `PAYMENT-RESPONSE` and verify its transaction on Base Sepolia if you need independent settlement proof.

## Setup

Requirements: Node.js 20.11 or newer, an OpenAI-compatible chat-completions API key, and a dedicated Base Sepolia test wallet funded with test USDC. The buyer key stays local and is never sent to the model. Do not use a mainnet wallet or key.

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` locally. Set `EVM_PRIVATE_KEY` to a dedicated test wallet key and `PAY_TO` to the seller's Base Sepolia receiving address. Request Base Sepolia test USDC from a faucet such as [Circle Faucet](https://faucet.circle.com/). The default facilitator is the x402.org test facilitator.

Start the local stalls in one terminal:

```powershell
npm run dev:seller
```

Run the research agent in another terminal:

```powershell
npm run dev:agent -- "Compare the rainfall, maize mandi price, and vegetation fixtures. State what this small sample can and cannot establish. Also probe both rogue sources and explain any refusal."
```

To exercise both hostile quotes without an LLM call, use a dedicated test key in `.env` and run:

```powershell
npm run check:rogues
```

The agent writes its answer to `research.md` and the payment decision/outcome events to `records/run.jsonl`. The honest endpoints cost $0.02, $0.03, and $0.04. The rogue routes quote $4.99 or a low amount in an unrecognized token; neither should reach its data handler.

## Checks

```powershell
npm test
npm run typecheck
```

The integration test uses local synthetic 402 responses to prove the hostile quotes are refused before signing. It does not claim a testnet transfer. A full testnet payment run requires a funded wallet and an LLM key configured on the machine running this repo; no payment record is fabricated or committed as if it were on-chain evidence.

## Audit Events

Each JSON line includes an `eventId`, UTC timestamp, source path, decision or outcome, reason, and relevant atomic amount. Refused quotes include the seller's offered requirements. Accepted quotes are recorded before signing; if the process stops before the outcome event, the remaining decision is intentionally visible as incomplete rather than silently treated as paid.