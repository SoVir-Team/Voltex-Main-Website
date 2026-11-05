import type { ReactNode } from "react";

/** Opening of an inner page: one large title and the sentence that says what the page is for. */
export function PageHead({ title, lead, children, id = "page-title" }: { title: string; lead: string; children?: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="frame grid-12 gap-y-8 pt-[clamp(3rem,7vw,7rem)] pb-[clamp(3rem,6vw,6rem)]">
      <h1 id={id} className="display rise-in col-span-12 text-[clamp(3rem,1.4rem+6vw,7.5rem)] lg:col-span-8">
        {title}
      </h1>
      <div className="col-span-12 self-end lg:col-span-4">
        <p className="rise-in max-w-[30rem] text-lead text-ink" style={{ ["--d" as string]: 2 }}>
          {lead}
        </p>
        {children}
      </div>
    </section>
  );
}
