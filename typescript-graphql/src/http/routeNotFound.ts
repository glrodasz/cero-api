import { MESSAGES } from "@cero/core";
import type { Plugin } from "graphql-yoga";

/**
 * Yoga answers paths other than its endpoint with an empty 404 (or a landing
 * page). This plugin makes them answer like every REST stack: 404 `{ message }`.
 */
export const useRouteNotFound = (graphqlEndpoint: string): Plugin => ({
  onRequest({ url, endResponse, fetchAPI }) {
    if (url.pathname !== graphqlEndpoint) {
      endResponse(fetchAPI.Response.json({ message: MESSAGES.ROUTE_NOT_FOUND }, { status: 404 }));
    }
  },
});
