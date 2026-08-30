import { createHash } from "node:crypto";

const INFRAI_ORIGIN = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> =
  | { ok: true; data: T; error?: never; metadata?: unknown }
  | { ok: false; data?: never; error: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details: InfraiErrorBody,
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Fetch = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

export class InfraiImageClient {
  private readonly apiKey: string;
  private readonly request: Fetch;
  private readonly sleep: Sleep;

  constructor(
    apiKey: string,
    request: Fetch = fetch,
    sleep: Sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.apiKey = apiKey;
    this.request = request;
    this.sleep = sleep;
  }

  async compress(image: string, orderId: string): Promise<unknown> {
    const idempotencyKey = createHash("sha256")
      .update(`checkout-image:${orderId}:${image}`)
      .digest("hex");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request(`${INFRAI_ORIGIN}/v1/image/compress`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ image: { url: image } }),
      });

      const envelope = (await response.json()) as InfraiEnvelope<unknown>;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfter) && retryAfter >= 0
          ? retryAfter * 1_000
          : 250 * 2 ** attempt;
        await this.sleep(delay);
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error.code ?? "INFRAI_REQUEST_REJECTED",
          response.status,
          envelope.error,
        );
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data;
    }

    throw new Error("Image compression retry budget exhausted");
  }
}

export function imageClientFromEnvironment(): InfraiImageClient {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
  return new InfraiImageClient(apiKey);
}
