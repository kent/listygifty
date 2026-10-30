import { createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTES } from "./auth.service";

// Built the same way as src/middleware.ts, so a bad pattern fails here first.
const matchesPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);
const isPublic = (pathname: string) => matchesPublicRoute({ nextUrl: { pathname } } as NextRequest);

describe("route protection", () => {
  it.each([
    "/",
    "/login",
    "/login/factor-one",
    "/signup",
    "/join/exchange/invite-token",
    "/e/family-christmas/share-token",
    "/e/family-christmas/share-token/opengraph-image",
    "/w/wishlist-share-token",
    "/claim/guest-claim-token",
    "/email-preferences/preferences-token",
  ])("lets a logged-out person open %s", (path) => {
    expect(isPublic(path)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/exchanges",
    "/exchanges/new",
    "/exchanges/family-christmas",
    "/exchanges/family-christmas/my-match",
    "/exchanges/family-christmas/my-wishlist",
    "/wishlists",
    "/wishlists/new",
    "/wishlists/12",
    "/workspaces/new",
    "/email-preferences",
  ])("sends a logged-out person to sign in from %s", (path) => {
    expect(isPublic(path)).toBe(false);
  });
});
