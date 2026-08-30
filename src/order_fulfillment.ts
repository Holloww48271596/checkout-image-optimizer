import { z } from "zod";

export const checkoutBody = z.object({
  orderId: z.string().min(1),
  customerEmail: z.string().email(),
  productImage: z.string().url(),
  totalCents: z.number().int().nonnegative(),
});

export type Checkout = z.infer<typeof checkoutBody>;

export type CheckoutResult = {
  orderId: string;
  checkoutStatus: "accepted";
  fulfillmentStatus: "preparing";
  optimizedImage: unknown;
  receipt: { orderId: string; customerEmail: string; totalCents: number };
  customerUpdate: { type: "order.confirmed"; message: string };
};

export type ImageOptimizer = {
  compress(image: string, orderId: string): Promise<unknown>;
};

export async function fulfillCheckout(
  checkout: Checkout,
  optimizer: ImageOptimizer,
): Promise<CheckoutResult> {
  const optimizedImage = await optimizer.compress(checkout.productImage, checkout.orderId);

  return {
    orderId: checkout.orderId,
    checkoutStatus: "accepted",
    fulfillmentStatus: "preparing",
    optimizedImage,
    receipt: {
      orderId: checkout.orderId,
      customerEmail: checkout.customerEmail,
      totalCents: checkout.totalCents,
    },
    customerUpdate: {
      type: "order.confirmed",
      message: `Order ${checkout.orderId} is confirmed and preparing for fulfillment.`,
    },
  };
}
