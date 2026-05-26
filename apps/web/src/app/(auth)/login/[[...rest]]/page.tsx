"use client";

import dynamic from "next/dynamic";
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

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <SignIn
        routing="path"
        path={AUTH_ROUTES.signIn}
        signUpUrl={AUTH_ROUTES.signUp}
        fallbackRedirectUrl={AUTH_ROUTES.afterSignIn}
      />
    </div>
  );
}
