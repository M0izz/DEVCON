import assert from "node:assert/strict";
import test from "node:test";
import { BASE_SEPOLIA, BASE_SEPOLIA_USDC, decidePayment, type PaymentOffer } from "../src/policy.js";

const payTo = "0x1111111111111111111111111111111111111111";
const policy = { maxPerCall: 250_000n, totalBudget: 5_000_000n, spentOrReserved: 0n, payTo };

function offer(overrides: Partial<PaymentOffer> = {}): PaymentOffer {
  return {
    scheme: "exact",
    network: BASE_SEPOLIA,
    asset: BASE_SEPOLIA_USDC,
    payTo,
    amount: "20000",
    ...overrides,
  };
}

test("approves a valid quote and selects the cheapest allowed offer", () => {
  const result = decidePayment([offer({ amount: "20000" }), offer({ amount: "12000" })], policy);
  assert.equal(result.approved, true);
  if (result.approved) assert.equal(result.amount, 12_000n);
});

test("refuses an overpriced one-row quote before signing", () => {
  const result = decidePayment([offer({ amount: "4990000" })], policy);
  assert.equal(result.approved, false);
  if (!result.approved) assert.equal(result.reason, "per_call_limit");
});

test("refuses unknown tokens, unsupported chains, and unexpected payees", () => {
  for (const [changed, expected] of [
    [offer({ asset: "0x2222222222222222222222222222222222222222" }), "unsupported_asset"],
    [offer({ network: "eip155:1" }), "unsupported_network"],
    [offer({ payTo: "0x3333333333333333333333333333333333333333" }), "unexpected_payee"],
  ] as const) {
    const result = decidePayment([changed], policy);
    assert.equal(result.approved, false);
    if (!result.approved) assert.equal(result.reason, expected);
  }
});

test("uses BigInt base units to enforce the remaining run budget", () => {
  const result = decidePayment([offer({ amount: "20000" })], { ...policy, spentOrReserved: 4_990_001n });
  assert.equal(result.approved, false);
  if (!result.approved) assert.equal(result.reason, "run_budget_limit");
});

test("rejects decimal and malformed amounts instead of rounding them", () => {
  for (const amount of ["0.02", "-1", "1e6", ""]) {
    const result = decidePayment([offer({ amount })], policy);
    assert.equal(result.approved, false);
    if (!result.approved) assert.equal(result.reason, "invalid_atomic_amount");
  }
});