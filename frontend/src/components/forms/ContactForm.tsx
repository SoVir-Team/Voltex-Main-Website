"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Honeypot, TextArea, TextField } from "@/components/ui/Field";
import { postJson } from "@/lib/client-api";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

export function ContactForm({ defaultSubject = "" }: { defaultSubject?: string }) {
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const found: Errors = {};
    if (!v("name")) found.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))) found.email = "Enter a valid email address.";
    if (v("message").length < 10) found.message = "Write a message of at least 10 characters.";
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }
    setSending(true);
    setServerError("");
    const res = await postJson("/api/contact", {
      name: v("name"),
      email: v("email"),
      phone: v("phone"),
      company: v("company"),
      subject: v("subject"),
      message: v("message"),
      website: v("website"),
    });
    setSending(false);
    if (!res.ok) {
      setServerError(res.data.message ?? "Something went wrong. Please try again.");
      requestAnimationFrame(() => alertRef.current?.focus());
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div role="status" className="bg-surface p-[clamp(2rem,5vw,3.5rem)]">
        <div className="flex h-14 w-14 items-center justify-center bg-success text-white">
          <Check aria-hidden className="h-7 w-7" />
        </div>
        <h2 className="mt-6 text-heading font-bold">Message sent.</h2>
        <p className="mt-4 text-muted">Thank you. We will reply within one working day.</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="relative space-y-6">
      <Honeypot />
      {serverError ? (
        <div ref={alertRef} tabIndex={-1} role="alert" className="bg-[#fbe9ea] px-4 py-3 font-medium text-danger">
          {serverError}
        </div>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Your name" name="name" required autoComplete="name" error={errors.name} />
        <TextField label="Email" name="email" type="email" required autoComplete="email" error={errors.email} />
        <TextField label="Phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" hint="Indian mobile, 10 digits." />
        <TextField label="Company" name="company" autoComplete="organization" />
      </div>
      <TextField label="Subject" name="subject" defaultValue={defaultSubject} />
      <TextArea label="Message" name="message" required rows={6} error={errors.message} />
      <Button type="submit" disabled={sending} className="min-w-48">
        {sending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
