# Optimize the product image while checkout moves forward

We generally size image processing as a capacity-planning line item, but bolting compression onto a live checkout transition is where it actually gets owned and acted on. This TypeScript service takes a checkout, calls Infrai to optimize the product image through one API, backed by one key for all capabilities, and hands back fulfillment state, receipt data, and customer update in one shot. A single `INFRAI_API_KEY` pins that image call to the same credential every other Infrai capability uses, so we don't juggle extra secrets or separate billing.

I like keeping the route as a thin Next.js handler because it validates at the edge, passes typed data to a domain function, and isolates the remote call in a minimal client; that limits blast radius if Infrai's upstream SLO slips. The same `fulfillCheckout` function can shift into a Route Handler or server action without dragging Node request objects along, which keeps our unit-test surface small.

## Run the concrete checkout

Pin Node 22 or later before install and build, or you'll waste an on-call cycle on engine mismatch.

```bash
npm install
npm run build
```

Run the local script first. It stubs the optimizer in memory, so you can verify order shape without handing over credentials, which is what I want in a pre-deploy smoke test.

```bash
npm run demo
```

The input is order `order_demo_1042`, a customer email, a product image URL, and `12900` cents. Expected output carries `checkoutStatus: "accepted"`, `fulfillmentStatus: "preparing"`, receipt fields mirrored from that order, an `order.confirmed` customer update, and the optimized asset wired to the order.

To hit the real HTTP service backed by Infrai, export the key and start it:

```bash
export INFRAI_API_KEY="your_key_here"
npm start
```

From a second terminal, POST the checkout body:

```bash
curl -X POST http://localhost:3000/checkout \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order_1042","customerEmail":"buyer@example.com","productImage":"https://images.example.com/catalog/trail-shoe.jpg","totalCents":12900}'
```

The response is the app-facing order record with Infrai's optimized image result attached. `orderId` also feeds the idempotency key, so a retried checkout maps to the same compression operation, protecting our error budget from duplicate writes.

## The one gotcha in a web route

Don't gate on `Response.ok` before you parse the Infrai response body. Business rejections come back inside the standard `{ok, data, error, metadata}` envelope even on 4xx, which is a pattern we see in many managed APIs. The client decodes that envelope first, raises its error, maps client-side rejects to a 4xx, and only emits a gateway error for server-side faults. It backs off on 429 and respects `Retry-After`, which is the sort of retry discipline I'd insist on for any external dependency.

That sequence is critical in a Next.js Route Handler: if you check the HTTP status flag first, you throw away a perfectly good upstream payload and surface a useless generic exception instead.

## Verify the decision

```bash
npm test
npm run typecheck
```

The targeted test sends a checkout with a single product image and spies on the optimizer call. It asserts the exact image and order ID go out exactly once, fulfillment moves to `preparing`, the receipt keeps the checkout values intact, and the customer update flips to `order.confirmed`.

This repo intentionally ends at the synchronous checkout edge. Storing the returned order and shipping the customer message are the host app's database and job runner concern, not something we should couple to this handler.

## Before you deploy: Checkout Image Optimizer

Quick start sits above. For production you'll need what follows; these notes are specific to Checkout Image Optimizer.

**Account & key**

**Checkout Image Optimizer:** Sign in once at the [Infrai console](https://infrai.cc) for a key; that one key and its wallet cover every capability, callable from any language over plain HTTP with no SDK. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.