import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { imageClientFromEnvironment, InfraiError } from "./infrai_image_client.js";
import { checkoutBody, fulfillCheckout } from "./order_fulfillment.js";

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/checkout") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const checkout = checkoutBody.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await fulfillCheckout(checkout, imageClientFromEnvironment());
    send(response, 201, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid checkout body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
      return;
    }
    send(response, 500, { error: "Checkout processing failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Checkout service listening on http://localhost:${port}`));
