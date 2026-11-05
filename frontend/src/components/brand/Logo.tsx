import { clsx } from "clsx";

/** The VOLTEX bolt, redrawn from the logo in its two brand blues. */
export function Bolt({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 40 56" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M22 0 4 31h13l-5 25 24-35H23l7-21z" fill="#2BA9DA" />
      <path d="M17 31 12 56l24-35H23z" fill="#299ED0" />
    </svg>
  );
}

/** Bolt + wordmark lockup. The wordmark is live text so it stays sharp and accessible. */
export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <Bolt className="h-[1.35em] w-auto -mr-0.5" />
      <span
        className={clsx("text-[1.05em] font-[850] tracking-[-0.02em] [font-stretch:125%]", inverted ? "text-on-ink" : "text-ink")}
      >
        VOLTEX
      </span>
    </span>
  );
}
