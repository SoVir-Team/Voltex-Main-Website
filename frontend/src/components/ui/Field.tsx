import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

const control =
  "mt-2 block w-full bg-surface px-4 py-3 text-[1rem] text-ink placeholder:text-[#7a7f9e] outline-none transition-[background-color,box-shadow] duration-150 focus:bg-ground focus:shadow-[inset_0_0_0_2px_var(--color-signal)] aria-[invalid=true]:shadow-[inset_0_0_0_2px_var(--color-danger)]";

type Common = { label: string; name: string; error?: string; hint?: ReactNode; required?: boolean; className?: string };

function Wrap({ label, name, error, hint, required, className, children }: Common & { children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="text-[0.95rem] font-semibold text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${name}-hint`} className="mt-1.5 text-small text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-small font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (name: string, error?: string, hint?: ReactNode) =>
  [error ? `${name}-error` : null, hint && !error ? `${name}-hint` : null].filter(Boolean).join(" ") || undefined;

export function TextField({ label, name, error, hint, required, className, ...props }: Common & Omit<ComponentProps<"input">, "name">) {
  return (
    <Wrap {...{ label, name, error, hint, required, className }}>
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={control}
        {...props}
      />
    </Wrap>
  );
}

export function TextArea({ label, name, error, hint, required, className, ...props }: Common & Omit<ComponentProps<"textarea">, "name">) {
  return (
    <Wrap {...{ label, name, error, hint, required, className }}>
      <textarea
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={clsx(control, "min-h-32 resize-y")}
        {...props}
      />
    </Wrap>
  );
}

export function SelectField({ label, name, error, hint, required, className, children, ...props }: Common & Omit<ComponentProps<"select">, "name">) {
  return (
    <Wrap {...{ label, name, error, hint, required, className }}>
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
        className={clsx(control, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%23292957%22><path d=%22M5 7l5 6 5-6z%22/></svg>')] bg-[length:1.1rem] bg-[right_1rem_center] bg-no-repeat pr-10")}
        {...props}
      >
        {children}
      </select>
    </Wrap>
  );
}

/** Hidden from people, visible to naive bots: the API rejects any submission that fills it. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
