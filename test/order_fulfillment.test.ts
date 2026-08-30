import assert from "node:assert/strict";
import test from "node:test";
import { fulfillCheckout } from "../src/order_fulfillment.js";

test("an accepted checkout starts fulfillment with its optimized product image", async () => {
  const calls: Array<{ image: string; orderId: string }> = [];
  const result = await fulfillCheckout(
    {
      orderId: "order_1042",
      customerEmail: "buyer@example.com",
      productImage: "https://images.example.com/catalog/trail-shoe.jpg",
      totalCents: 12_900,
    },
    {
      async compress(image, orderId) {
        calls.push({ image, orderId });
        return { asset: "optimized/order_1042" };
      },
    },
  );

  assert.deepEqual(calls, [{
    image: "https://images.example.com/catalog/trail-shoe.jpg",
    orderId: "order_1042",
  }]);
  assert.equal(result.checkoutStatus, "accepted");
  assert.equal(result.fulfillmentStatus, "preparing");
  assert.deepEqual(result.optimizedImage, { asset: "optimized/order_1042" });
  assert.deepEqual(result.receipt, {
    orderId: "order_1042",
    customerEmail: "buyer@example.com",
    totalCents: 12_900,
  });
  assert.equal(result.customerUpdate.type, "order.confirmed");
});
