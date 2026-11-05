import type { ReactNode } from "react";

/** Long-form pages (privacy, terms, credits): one comfortable reading column. */
export function Prose({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="frame grid-12 pt-[clamp(3rem,7vw,7rem)] pb-[clamp(5rem,10vw,9rem)]">
      <header className="col-span-12 lg:col-span-4">
        <h1 className="display text-[clamp(2.6rem,1.4rem+4vw,5rem)]">{title}</h1>
        {updated ? <p className="mt-4 text-muted">Last updated {updated}</p> : null}
      </header>
      <div className="col-span-12 mt-10 max-w-[44rem] space-y-5 text-[1.0625rem] lg:col-span-7 lg:col-start-6 lg:mt-3 [&_h2]:pt-6 [&_h2]:text-[1.5rem] [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2 [&_a]:link">
        {children}
      </div>
    </article>
  );
}
