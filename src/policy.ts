export const BASE_SEPOLIA = "eip155:84532";
export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export interface PaymentOffer {
  scheme?: string;
  network?: string;
  asset?: string;
  payTo?: string;
  amount?: string;
}

export interface SpendPolicy {
  maxPerCall: bigint;
  totalBudget: bigint;
  spentOrReserved: bigint;
  payTo: string;
}

export type PaymentDecision =
  | { approved: true; offer: PaymentOffer; amount: bigint; reason: "within_policy" }
  | {
      approved: false;
      reason:
        | "no_payment_options"
        | "unsupported_scheme"
        | "unsupported_network"
        | "unsupported_asset"
        | "unexpected_payee"
        | "invalid_atomic_amount"
        | "per_call_limit"
        | "run_budget_limit";
      details: string;
    };

export function decidePayment(offers: PaymentOffer[], policy: SpendPolicy): PaymentDecision {
  if (offers.length === 0) {
    return { approved: false, reason: "no_payment_options", details: "The seller supplied no payment options." };
  }

  const viable: Array<{ offer: PaymentOffer; amount: bigint }> = [];
  let rejection: Extract<PaymentDecision, { approved: false }> | undefined;

  for (const offer of offers) {
    if (offer.scheme !== "exact") {
      rejection ??= { approved: false, reason: "unsupported_scheme", details: "Only the exact payment scheme is allowed." };
      continue;
    }
    if (offer.network !== BASE_SEPOLIA) {
      rejection ??= { approved: false, reason: "unsupported_network", details: "Only Base Sepolia is allowed." };
      continue;
    }
    if (offer.asset?.toLowerCase() !== BASE_SEPOLIA_USDC.toLowerCase()) {
      rejection ??= { approved: false, reason: "unsupported_asset", details: "Only the configured Base Sepolia USDC contract is allowed." };
      continue;
    }
    if (offer.payTo?.toLowerCase() !== policy.payTo.toLowerCase()) {
      rejection ??= { approved: false, reason: "unexpected_payee", details: "The seller payee is not on the buyer's allowlist." };
      continue;
    }
    if (typeof offer.amount !== "string" || !/^\d+$/.test(offer.amount)) {
      rejection ??= { approved: false, reason: "invalid_atomic_amount", details: "The quoted amount is not an integer in token base units." };
      continue;
    }

    const amount = BigInt(offer.amount);
    if (amount > policy.maxPerCall) {
      rejection ??= { approved: false, reason: "per_call_limit", details: "The quote exceeds the per-call limit." };
      continue;
    }
    if (policy.spentOrReserved + amount > policy.totalBudget) {
      rejection ??= { approved: false, reason: "run_budget_limit", details: "The quote would exceed the remaining run budget." };
      continue;
    }
    viable.push({ offer, amount });
  }

  if (viable.length === 0) {
    return rejection ?? { approved: false, reason: "no_payment_options", details: "No quote passed spending policy." };
  }

  viable.sort((left, right) => (left.amount < right.amount ? -1 : left.amount > right.amount ? 1 : 0));
  const selected = viable[0]!;
  return { approved: true, offer: selected.offer, amount: selected.amount, reason: "within_policy" };
}