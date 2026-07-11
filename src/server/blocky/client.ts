import ky from "ky";

import { env } from "~/env";

export const blockyApi = ky.create({
  baseUrl: env.BLOCKY_API_URL,
  headers: {
    "Content-Type": "application/json",
    ...env.BLOCKY_REQUEST_HEADERS,
  },
});
