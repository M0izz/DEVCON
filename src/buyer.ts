import { randomUUID } from "node:crypto";
import { x402Client, x402HTTPClient, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { AuditLog } from "./audit.js";
import {
  BASE_SEPOLIA,
  BASE_SEPOLIA_USDC,
  decidePayment,
  type PaymentOffer,
} from "./policy.js";

type PaymentRequiredBody = {
  x402Version?: number;
  accepts?: PaymentOffer[];
  error?: string;
};

type BuyerConfig = {
  privateKey: `0x${string}`;
  payTo: string;
  maxPerCall: bigint;
  totalBudget: bigint;
  audit: AuditLog;
};

function sameOffer(left: PaymentOffer, right: PaymentOffer): boolean {
  return left.scheme === right.scheme
    && left.network === right.network
    && left.asset?.toLowerCase() === right.asset?.toLowerCase()
    && left.payTo?.toLowerCase() === right.payTo?.toLowerCase()
    && left.amount === right.amount;
}

function offersFromBody(body: PaymentRequiredBody | undefined): PaymentOffer[] {
  if (!body || !Array.isArray(body.accepts)) return [];
  return body.accepts.filter((offer): offer is PaymentOffer => typeof offer === "object" && offer !== null);
}

export function createPaidFetch(config: BuyerConfig): {
  fetchPaid: (url: string) => Promise<Response>;
  getReservedAtomic: () => bigint;
} {
  let reservedAtomic = 0n;
  let activeDecision: ReturnType<typeof decidePayment> | undefined;
  let activeEventId: string | undefined;
  let activeSource: string | undefined;

  const client = new x402Client((_version, requirements) => {
    const decision = activeDecision;
    if (!decision?.approved) throw new Error("No buyer-approved quote is active.");
    const matchingOffer = requirements.find((offer) => sameOffer(offer, decision.offer));
    if (!matchingOffer) throw new Error("The x402 client did not retain the buyer-approved quote.");
    return matchingOffer;
  });
  client
    .register("eip155:*", new ExactEvmScheme(privateKeyToAccount(config.privateKey)))
    .setSpendControls({
      maxAmountPerPayment: "$5",
      allowedAssets: [{
        network: BASE_SEPOLIA,
        asset: BASE_SEPOLIA_USDC,
        maxAmountPerPayment: config.maxPerCall.toString(),
      }],
    });

  const httpClient = new x402HTTPClient(client);
  const guardedFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const isPaymentRetry = request.headers.has("PAYMENT-SIGNATURE") || request.headers.has("X-PAYMENT");
    const response = await fetch(request);
    if (response.status !== 402 || isPaymentRetry) return response;

    const responseForBody = response.clone();
    let body: PaymentRequiredBody | undefined;
    try {
      body = await responseForBody.json() as PaymentRequiredBody;
    } catch {
      body = undefined;
    }

    let paymentRequired: PaymentRequiredBody;
    try {
      paymentRequired = httpClient.getPaymentRequiredResponse(
        (name) => response.headers.get(name),
        body,
      ) as PaymentRequiredBody;
    } catch {
      paymentRequired = body ?? {};
    }

    const offers = offersFromBody(paymentRequired);
    const decision = decidePayment(offers, {
      maxPerCall: config.maxPerCall,
      totalBudget: config.totalBudget,
      spentOrReserved: reservedAtomic,
      payTo: config.payTo,
    });
    const eventId = randomUUID();
    activeEventId = eventId;
    activeSource = new URL(input instanceof Request ? input.url : input.toString()).pathname;

    if (!decision.approved) {
      config.audit.write({
        eventId,
        event: "payment_decision",
        decision: "refused",
        reason: decision.reason,
        details: decision.details,
        source: activeSource,
        quotedOffers: offers,
        spentOrReservedAtomic: reservedAtomic.toString(),
      });
      activeDecision = undefined;
      throw new Error(`Payment refused (${decision.reason}): ${decision.details}`);
    }

    activeDecision = decision;
    reservedAtomic += decision.amount;
    config.audit.write({
      eventId,
      event: "payment_decision",
      decision: "approved",
      reason: decision.reason,
      source: activeSource,
      network: decision.offer.network,
      asset: decision.offer.asset,
      payTo: decision.offer.payTo,
      amountAtomic: decision.amount.toString(),
      amountUsdc: (Number(decision.amount) / 1_000_000).toFixed(6),
      spentOrReservedAtomic: reservedAtomic.toString(),
    });
    return response;
  };

  const fetchWithPayment = wrapFetchWithPayment(guardedFetch, client);

  return {
    async fetchPaid(url: string): Promise<Response> {
      try {
        const response = await fetchWithPayment(url);
        if (activeDecision?.approved && activeEventId) {
          const paid = response.ok;
          const paymentResponse = response.headers.get("PAYMENT-RESPONSE")
            ?? response.headers.get("X-PAYMENT-RESPONSE");
          config.audit.write({
            eventId: activeEventId,
            event: "payment_outcome",
            outcome: paid ? "paid" : "failed",
            reason: paid ? "seller_returned_success" : `seller_returned_http_${response.status}`,
            source: activeSource,
            httpStatus: response.status,
            amountAtomic: activeDecision.amount.toString(),
            paymentResponse,
          });
        }
        return response;
      } catch (error) {
        if (activeDecision?.approved && activeEventId) {
          config.audit.write({
            eventId: activeEventId,
            event: "payment_outcome",
            outcome: "failed_or_unconfirmed",
            reason: error instanceof Error ? error.message : "Unknown payment error",
            source: activeSource,
            amountAtomic: activeDecision.amount.toString(),
          });
        }
        throw error;
      } finally {
        activeDecision = undefined;
        activeEventId = undefined;
        activeSource = undefined;
      }
    },
    getReservedAtomic: () => reservedAtomic,
  };
}

export function loadBuyerConfig(audit: AuditLog): BuyerConfig {
  const privateKey = process.env.EVM_PRIVATE_KEY;
  const payTo = process.env.PAY_TO;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("EVM_PRIVATE_KEY must be a 0x-prefixed 32-byte private key.");
  }
  if (!payTo || !/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
    throw new Error("PAY_TO must be the explicitly trusted seller payout address.");
  }
  return {
    privateKey: privateKey as `0x${string}`,
    payTo,
    maxPerCall: BigInt(process.env.MAX_PER_CALL_ATOMIC ?? "250000"),
    totalBudget: BigInt(process.env.RUN_BUDGET_ATOMIC ?? "5000000"),
    audit,
  };
}

export const paymentNetwork = BASE_SEPOLIA;
export const paymentAsset = BASE_SEPOLIA_USDC;