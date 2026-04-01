import { GraphQLClient } from "graphql-request";

const SORARE_API_URL =
  process.env.SORARE_API_URL || "https://api.sorare.com/federation/graphql";
const SORARE_API_KEY = process.env.SORARE_API_KEY || "";

export const sorareClient = new GraphQLClient(SORARE_API_URL, {
  headers: {
    ...(SORARE_API_KEY ? { APIKEY: SORARE_API_KEY } : {}),
    "Content-Type": "application/json",
  },
});
