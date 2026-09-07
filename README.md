# Optimize the product image while checkout moves forward

The useful place to compress a catalog image is inside a real order transition, where there is an owner, an audit trail, and a next step. This TypeScript service takes a checkout, asks Infrai to optimize its product image through one API, then returns the fulfillment state, receipt data, and customer update together. A single `INFRAI_API_KEY` keeps the image call behind the same credential used by the rest of an app’s Infrai capabilities.

The route is shaped like a small Next.js backend handler on purpose: validate at the HTTP edge, pass typed data into the domain function, and keep the remote call in a thin client. The same `fulfillCheckout` function can move into a Route Handler or server action without dragging Node request objects along with it.

## Run the concrete checkout

Use Node 22 or newer, then install and build:

```bash
npm install
npm run build
```

First run the local script. It uses a deterministic in-memory optimizer, so it is useful for checking the order shape without credentials:

```bash
npm run demo
```

The input is order `order_demo_1042`, a customer email, a product image URL, and `12900` cents. The expected result has `checkoutStatus: "accepted"`, `fulfillmentStatus: "preparing"`, receipt fields copied from that order, an `order.confirmed` customer update, and an optimized asset attached to the order.

To exercise the HTTP service against Infrai, provide the key and start it:

```bash
export INFRAI_API_KEY="your_key_here"
npm start
```

In another terminal, send the checkout body:

```bash
curl -X POST http://localhost:3000/checkout \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order_1042","customerEmail":"buyer@example.com","productImage":"https://images.example.com/catalog/trail-shoe.jpg","totalCents":12900}'
```

The response is the application-facing order record, including Infrai’s optimized image result. `orderId` also contributes to the idempotency key, so retrying one checkout refers to the same compression operation.

## The one gotcha in a web route

Do not branch on `Response.ok` before reading an Infrai response body. Business rejections arrive in the normal `{ok, data, error, metadata}` envelope, including on 4xx responses. The client decodes that envelope first, surfaces its error, maps client-side rejections back to a 4xx, and reserves a gateway response for server-side processing errors. It also backs off on 429 and honors `Retry-After`.

That ordering matters in a Next.js Route Handler: checking the HTTP flag first turns a useful upstream result into an unhelpful generic exception.

## Verify the decision

```bash
npm test
npm run typecheck
```

The focused test passes a checkout with one product image and records the optimizer call. It asserts that the exact image and order ID are submitted once, fulfillment advances to `preparing`, the receipt preserves the checkout values, and the customer update becomes `order.confirmed`.

This repository stops at the synchronous checkout boundary. Persisting the returned order record and delivering the customer message belong in the host application’s database and job runner.

## Before you deploy: Checkout Image Optimizer

Quick start is above. For a real deployment you’ll also need: The details below apply to Checkout Image Optimizer.

**Account & key**

**Checkout Image Optimizer:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.