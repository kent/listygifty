"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { oauthAuthorizationService, type OAuthConsent } from "@/services";

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  read: "View your Listy Gifty workspaces, occasions, people, gifts, wishlists, and exchanges.",
  write: "Create and update Listy Gifty data on your behalf.",
  admin: "Access global product administration, analytics, support, email, and guarded deletion tools.",
};

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "The authorization request could not be loaded.";
}

function clientHost(uri: string | null) {
  if (!uri) return null;
  try {
    return new URL(uri).hostname;
  } catch {
    return null;
  }
}

function OAuthAuthorizeContent() {
  const searchParams = useSearchParams();
  const requestToken = searchParams.get("request_token");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [loadedConsent, setLoadedConsent] = useState<{ requestToken: string; value: OAuthConsent } | null>(null);
  const [authorizationError, setAuthorizationError] = useState<{ requestToken: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [adminAcknowledged, setAdminAcknowledged] = useState(false);
  const consent = loadedConsent?.requestToken === requestToken ? loadedConsent.value : null;
  const error = authorizationError?.requestToken === requestToken ? authorizationError.message : null;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !requestToken) return;

    setLoadedConsent(null);
    setAuthorizationError(null);
    setSubmitting(null);
    setAdminAcknowledged(false);
    const controller = new AbortController();
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Your Listy Gifty session has expired. Please sign in again.");
        const result = await oauthAuthorizationService.getConsent(requestToken, token, controller.signal);
        if (!controller.signal.aborted) setLoadedConsent({ requestToken, value: result });
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setAuthorizationError({ requestToken, message: errorMessage(requestError) });
        }
      }
    })();

    return () => controller.abort();
  }, [getToken, isLoaded, isSignedIn, requestToken]);

  const callbackHost = useMemo(
    () => clientHost(consent?.client.redirect_uri || null),
    [consent]
  );

  const decide = useCallback(async (decision: "approve" | "deny") => {
    if (!requestToken || loadedConsent?.requestToken !== requestToken || !consent || submitting) return;
    setSubmitting(decision);
    setAuthorizationError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your Listy Gifty session has expired. Please sign in again.");
      const result = await oauthAuthorizationService.decide(requestToken, decision, token);
      window.location.assign(result.redirect_uri);
    } catch (decisionError) {
      setAuthorizationError({ requestToken, message: errorMessage(decisionError) });
      setSubmitting(null);
    }
  }, [consent, getToken, loadedConsent?.requestToken, requestToken, submitting]);

  if (!requestToken) {
    return <AuthorizationError message="This authorization link is missing its one-time request token." />;
  }

  if (isLoaded && !isSignedIn) {
    const returnUrl = `/oauth/authorize?request_token=${encodeURIComponent(requestToken)}`;
    return (
      <AuthorizationError message="Sign in to Listy Gifty before approving this connection.">
        <Button asChild><Link href={`/login?redirect_url=${encodeURIComponent(returnUrl)}`}>Sign in</Link></Button>
      </AuthorizationError>
    );
  }

  if (error && !consent) return <AuthorizationError message={error} />;

  if (!consent) return <AuthorizationLoader />;

  const Icon = consent.resource.admin ? ShieldAlert : ShieldCheck;
  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-xl items-center px-4 py-12">
      <Card className="w-full border-slate-200/80 shadow-xl dark:border-slate-800">
        <CardHeader className="space-y-4 text-center">
          <div className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${consent.resource.admin ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"}`}>
            <Icon className="size-7" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-2xl">
              {consent.client.verified ? `Authorize ${consent.client.name}` : "Authorize an unverified MCP client"}
            </CardTitle>
            <CardDescription className="mt-2">
              {!consent.client.verified && <>Self-reported name: <strong>{consent.client.name}</strong>. </>}
              {consent.resource.name} will send the one-time authorization result to {callbackHost || "the callback shown below"}.
            </CardDescription>
            <div className={`mx-auto mt-3 w-fit rounded-full px-3 py-1 text-xs font-semibold ${consent.client.verified ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}`}>
              {consent.client.verified ? "Pre-registered client" : "Unverified client metadata"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <strong>{consent.client.verified ? "Registered callback" : "Unverified callback — verify carefully"}</strong>
            <p className="mt-1">The authorization code will be sent to this exact URI:</p>
            <code className="mt-2 block break-all rounded bg-black/5 p-2 text-xs dark:bg-white/10">{consent.client.redirect_uri}</code>
            {!consent.client.verified && <p className="mt-2">The application supplied its own name and website. Those labels do not prove its identity. Trust the callback URI, not the displayed client name.</p>}
          </div>

          {consent.resource.admin && (
            <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
              <p><strong>Administrator access:</strong> this connection can inspect global product data and use sensitive, audited admin tools. Approve only if you initiated this connection and recognize the callback URI above.</p>
              <label className="flex cursor-pointer items-start gap-2 font-medium">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={adminAcknowledged}
                  onChange={(event) => setAdminAcknowledged(event.target.checked)}
                />
                I initiated this connection and verified the callback URI.
              </label>
            </div>
          )}

          {consent.client.description && (
            <p className="text-sm text-muted-foreground">
              {!consent.client.verified && <strong>Self-reported description: </strong>}
              {consent.client.description}
            </p>
          )}

          <section aria-labelledby="permissions-heading">
            <h2 id="permissions-heading" className="mb-3 text-sm font-semibold">Requested permissions</h2>
            <ul className="space-y-3">
              {consent.requested_scopes.map((scope) => (
                <li key={scope} className="flex gap-3 rounded-lg bg-muted/60 p-3 text-sm">
                  <KeyRound className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden="true" />
                  <div><strong className="capitalize">{scope}</strong><p className="mt-0.5 text-muted-foreground">{SCOPE_DESCRIPTIONS[scope] || "Use this Listy Gifty permission."}</p></div>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-muted-foreground">Signed in as {consent.user.email}. Access tokens expire after one hour and can be revoked from Settings.</p>
          {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={submitting !== null} onClick={() => void decide("deny")}>
              {submitting === "deny" ? "Denying…" : "Deny"}
            </Button>
            <Button
              variant={consent.resource.admin ? "destructive" : "default"}
              disabled={submitting !== null || (consent.resource.admin && !adminAcknowledged)}
              onClick={() => void decide("approve")}
            >
              {submitting === "approve" ? "Authorizing…" : consent.resource.admin ? "Authorize admin access" : "Authorize"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function AuthorizationLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      <span className="sr-only">Loading authorization request</span>
    </div>
  );
}

function AuthorizationError({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-12">
      <Card className="w-full"><CardHeader><CardTitle>Authorization unavailable</CardTitle><CardDescription>{message}</CardDescription></CardHeader>{children && <CardContent>{children}</CardContent>}</Card>
    </main>
  );
}

export default function OAuthAuthorizePage() {
  return <Suspense fallback={<div className="min-h-[60vh]" />}><OAuthAuthorizeContent /></Suspense>;
}
