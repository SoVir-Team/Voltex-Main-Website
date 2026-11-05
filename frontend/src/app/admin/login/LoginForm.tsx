"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { postJson } from "@/lib/client-api";

export function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await postJson("/api/admin/login", { email: f.get("email"), password: f.get("password") });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.message ?? "Sign in failed.");
      return;
    }
    const next = params.get("next");
    // Only same-site admin paths are allowed as a return address.
    window.location.href = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      {error ? (
        <p role="alert" className="bg-[#fbe9ea] px-4 py-3 font-medium text-danger">
          {error}
        </p>
      ) : null}
      <TextField label="Email" name="email" type="email" required autoComplete="username" />
      <TextField label="Password" name="password" type="password" required autoComplete="current-password" />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
