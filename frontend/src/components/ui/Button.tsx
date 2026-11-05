import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "bolt" | "light" | "ghost";

// One button shape for the whole site: square corners, flat fill, 48px tall.
const base =
  "group inline-flex min-h-12 items-center justify-center gap-2 px-6 text-[0.95rem] font-semibold tracking-[-0.005em] transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-on-ink hover:bg-ink-deep",
  bolt: "bg-bolt text-ink-deep hover:bg-[#46b7e2]",
  light: "bg-ground text-ink hover:bg-surface",
  ghost: "bg-surface text-ink hover:bg-surface-2",
};

export const buttonClass = (variant: Variant = "primary", className?: string) => clsx(base, variants[variant], className);

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
  arrow = false,
  ...rest
}: { href: string; variant?: Variant; className?: string; children: ReactNode; arrow?: boolean } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, className)} {...rest}>
      {children}
      {arrow ? (
        <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
          →
        </span>
      ) : null}
    </Link>
  );
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
