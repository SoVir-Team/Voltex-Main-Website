import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/brand/Logo";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-on-ink lg:flex">
        <Logo inverted className="text-[1.3rem]" />
        <p className="monument text-[clamp(3rem,6vw,6rem)] leading-[0.9]">Control room.</p>
        <p className="text-on-ink-muted">Products, order requests, ideas and messages for the VOLTEX website.</p>
      </div>
      <div className="flex items-center justify-center bg-ground p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo className="text-[1.2rem]" />
          </div>
          <h1 className="mt-10 text-[2rem] font-bold lg:mt-0">Admin sign in</h1>
          <p className="mt-2 text-muted">For VOLTEX staff only.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
