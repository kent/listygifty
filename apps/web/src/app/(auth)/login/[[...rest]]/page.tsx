"use client";

import { Suspense, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { DEMO_ACCOUNT_EMAIL, demoSignInPath, isDemoAccountEmail } from "@/lib/demo-account";
import { AUTH_ROUTES } from "@/services";

// Dynamically import SignIn to avoid SSR issues with Clerk
const SignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    ),
  }
);

// App directory reviewers (such as OpenAI's) sign in to a sample account here.
function DemoAccountLink() {
  const redirectUrl = useSearchParams().get("redirect_url");
  return (
    <Link
      href={demoSignInPath(redirectUrl)}
      className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent"
    >
      Reviewing Listy Gifty? Use the demo account
    </Link>
  );
}

// The demo account has no inbox, so a reviewer who types its email into the
// regular form would wait forever for a code. Send them to the demo sign-in.
// This watches each new sign-in attempt rather than the current one, so an
// attempt left over from before this page loaded doesn't bounce anyone away.
function DemoAccountRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const redirectUrl = useSearchParams().get("redirect_url");
  const { signIn } = useSignIn();
  const attemptOnArrival = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!signIn) return;
    const attemptId = signIn.id ?? null;
    if (attemptOnArrival.current === undefined) {
      attemptOnArrival.current = attemptId;
      return;
    }
    if (attemptId !== attemptOnArrival.current && isDemoAccountEmail(signIn.identifier)) {
      router.replace(demoSignInPath(redirectUrl, DEMO_ACCOUNT_EMAIL));
    }
  }, [signIn, signIn?.id, signIn?.identifier, pathname, redirectUrl, router]);

  return null;
}

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[50vh]">
      <SignIn
        routing="path"
        path={AUTH_ROUTES.signIn}
        signUpUrl={AUTH_ROUTES.signUp}
        fallbackRedirectUrl={AUTH_ROUTES.afterSignIn}
      />
      <Suspense>
        <DemoAccountLink />
        <DemoAccountRedirect />
      </Suspense>
    </div>
  );
}
