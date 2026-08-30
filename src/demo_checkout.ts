import { fulfillCheckout } from "./order_fulfillment.js";

const result = await fulfillCheckout(
  {
    orderId: "order_demo_1042",
    customerEmail: "dev@example.com",
    productImage: "https://images.example.com/catalog/trail-shoe.jpg",
    totalCents: 12_900,
  },
  {
    async compress(image, orderId) {
      return { source: image, asset: `optimized/${orderId}` };
    },
  },
);

console.log(JSON.stringify(result, null, 2));
