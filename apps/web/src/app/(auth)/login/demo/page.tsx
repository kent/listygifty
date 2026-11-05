"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignOutButton, useAuth, useSignIn } from "@clerk/nextjs";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeRedirect } from "@/lib/safe-redirect";
import { AUTH_ROUTES, demoSessionService } from "@/services";

function DemoSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = safeRedirect(searchParams.get("redirect_url"));
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signIn || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const { ticket } = await demoSessionService.create(email.trim());
      const attempt = await signIn.create({ strategy: "ticket", ticket });
      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        throw new Error("The demo sign-in didn't finish. Try again.");
      }
      await setActive({ session: attempt.createdSessionId });
      router.replace(redirectUrl);
    } catch (submitError) {
      setError(submitError instanceof ApiError || submitError instanceof Error ? submitError.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  const backToSignIn = `${AUTH_ROUTES.signIn}?redirect_url=${encodeURIComponent(redirectUrl)}`;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Demo account</CardTitle>
        <CardDescription>
          For app reviewers. Enter the demo account email to sign in to a sample account. No code needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSignedIn ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">You&apos;re signed in to another account. Sign out first to use the demo account.</p>
            <SignOutButton redirectUrl={`/login/demo?redirect_url=${encodeURIComponent(redirectUrl)}`}>
              <Button className="w-full">Sign out</Button>
            </SignOutButton>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="demo-email">Email</Label>
              <Input
                id="demo-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={!isLoaded || submitting}>
              {submitting ? "Signing in…" : "Sign in to demo"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href={backToSignIn} className="text-muted-foreground underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function DemoSignInPage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Suspense>
        <DemoSignIn />
      </Suspense>
    </div>
  );
}
