import { defineHandler } from "h3";
import { fetchNodeHandler } from "srvx/node";
import { getApplication } from "../../app.mjs";

// Vercel invokes Nitro with a WHATWG Request, without raw Node req/res objects.
// srvx supplies the maintained Node adapter required by Express in that runtime.
export default defineHandler(async (event) => {
  const app = await getApplication();
  return fetchNodeHandler(app, event.req);
});
