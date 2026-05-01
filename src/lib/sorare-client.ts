import { GraphQLClient, type Variables } from "graphql-request";

const SORARE_API_URL =
  process.env.SORARE_API_URL || "https://api.sorare.com/federation/graphql";
const SORARE_API_KEY = process.env.SORARE_API_KEY || "";

const rawClient = new GraphQLClient(SORARE_API_URL, {
  headers: {
    ...(SORARE_API_KEY ? { APIKEY: SORARE_API_KEY } : {}),
    "Content-Type": "application/json",
  },
});

/**
 * Cap the number of concurrent Sorare GraphQL requests. Many of our routes
 * fan out per-slug (player-scores, live-scores, player-form, etc.) and the
 * Next.js dev server can also serve multiple requests in parallel. Without a
 * gate, a single home/workspace render with a large gallery can fire 100+
 * concurrent requests at Sorare and trip the per-account 429, taking down
 * unrelated calls (fixtures, in-season competitions) as collateral damage.
 *
 * 4 is conservative but enough to keep latency reasonable — pair it with
 * batched chunking on the client (sequential chunks in `usePlayerIntel`).
 */
const MAX_CONCURRENT = 4;
let inFlight = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (inFlight < MAX_CONCURRENT) {
        inFlight++;
        resolve(() => {
          inFlight--;
          const next = queue.shift();
          if (next) next();
        });
      } else {
        queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

export const sorareClient = {
  request<T = unknown>(query: string, variables?: Variables): Promise<T> {
    return acquire().then(async (release) => {
      try {
        return await rawClient.request<T>(query, variables);
      } finally {
        release();
      }
    });
  },
};
