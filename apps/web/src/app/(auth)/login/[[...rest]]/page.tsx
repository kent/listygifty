"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const href = redirectUrl ? `/login/demo?redirect_url=${encodeURIComponent(redirectUrl)}` : "/login/demo";
  return (
    <Link href={href} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
      Reviewing Listy Gifty? Use the demo account
    </Link>
  );
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
      </Suspense>
    </div>
  );
}
