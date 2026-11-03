import createClient from "openapi-fetch";
import type { paths } from "spec/api";

/**
 * Typed client for `/api/*`; paths and bodies come from `spec/openapi.yaml`. Cookies go with the request.
 * The origin is absolute so `Request` accepts the URL in tests as well as in the browser.
 * `fetch` is read at call time so tests can stub `globalThis.fetch`.
 */
export const api = createClient<paths>({
  baseUrl: globalThis.location.origin,
  credentials: "include",
  fetch: async (request) => {
    const response = await globalThis.fetch(request);
    return response;
  },
});
