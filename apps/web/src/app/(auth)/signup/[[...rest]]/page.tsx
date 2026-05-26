"use client";

import dynamic from "next/dynamic";
import { AUTH_ROUTES } from "@/services";

// Dynamically import SignUp to avoid SSR issues with Clerk
const SignUp = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignUp),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    ),
  }
);

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <SignUp
        routing="path"
        path={AUTH_ROUTES.signUp}
        signInUrl={AUTH_ROUTES.signIn}
        fallbackRedirectUrl={AUTH_ROUTES.afterSignUp}
      />
    </div>
  );
}
