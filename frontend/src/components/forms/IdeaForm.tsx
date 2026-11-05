"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { Check } from "lucide-react";
import { IDEA_SERVICES, IDEA_STAGES } from "@voltex/shared";
import { Button } from "@/components/ui/Button";
import { Honeypot, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { postJson } from "@/lib/client-api";

type Errors = Partial<Record<"name" | "email" | "phone" | "stage" | "description", string>>;

export function IdeaForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const alertRef = useRef<HTMLDivElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const found: Errors = {};
    if (!v("name")) found.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))) found.email = "Enter a valid email address.";
    if (!v("stage")) found.stage = "Tell us how far along the idea is.";
    if (v("description").length < 20) found.description = "Describe the idea in at least 20 characters.";
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }
    setSending(true);
    setServerError("");
    const res = await postJson("/api/ideas", {
      name: v("name"),
      email: v("email"),
      phone: v("phone"),
      company: v("company"),
      stage: v("stage"),
      services,
      quantity: v("quantity"),
      timeline: v("timeline"),
      description: v("description"),
      ndaRequested: f.get("nda") === "on",
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
        <h3 className="mt-6 text-heading font-bold">Your idea is with our engineers.</h3>
        <p className="mt-4 max-w-[34rem] text-muted">
          We will read it carefully and reply within one working day with questions or a first plan. If you asked for an NDA, it will
          arrive first.
        </p>
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
        <TextField label="Phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" error={errors.phone} hint="Indian mobile, 10 digits." />
        <TextField label="Company" name="company" autoComplete="organization" />
      </div>
      <SelectField label="Where is the idea today?" name="stage" required defaultValue="" error={errors.stage}>
        <option value="" disabled>
          Choose one
        </option>
        {IDEA_STAGES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </SelectField>
      <fieldset>
        <legend className="text-[0.95rem] font-semibold">
          What do you need from us? <span className="font-normal text-muted">(choose any)</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {IDEA_SERVICES.map((s) => {
            const on = services.includes(s);
            return (
              <label
                key={s}
                className={clsx(
                  "cursor-pointer select-none px-4 py-2.5 text-[0.95rem] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-bolt-deep",
                  on ? "bg-ink text-on-ink" : "bg-surface text-ink hover:bg-surface-2",
                )}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setServices((x) => (on ? x.filter((y) => y !== s) : [...x, s]))} />
                {s}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Expected quantity" name="quantity" placeholder="e.g. 10 prototypes, then 2,000 a year" />
        <TextField label="When do you need it?" name="timeline" placeholder="e.g. prototypes by March" />
      </div>
      <TextArea
        label="Describe your idea"
        name="description"
        required
        rows={6}
        error={errors.description}
        hint="What it does, who it is for, and anything you already have (sketches, code, parts)."
      />
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="nda" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-ink)]" />
        <span>Please send me a mutual NDA before we discuss details.</span>
      </label>
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Button type="submit" disabled={sending} className="min-w-52">
          {sending ? "Sending…" : "Send my idea"}
        </Button>
        <p className="text-small text-muted">We reply within one working day. Your details are used only to answer you.</p>
      </div>
    </form>
  );
}
