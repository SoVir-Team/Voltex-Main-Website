import { Reveal } from "@/components/motion/Reveal";
import { FAQ } from "@/lib/site";

/** Every answer is open: large questions on the left act as an index, answers sit beside them. */
export function Faq({ items = FAQ }: { items?: readonly { q: string; a: string }[] }) {
  return (
    <Reveal as="section" aria-labelledby="faq-title" className="frame section-gap">
      <div className="grid-12">
        <h2 id="faq-title" data-reveal className="col-span-12 text-[clamp(1.6rem,1.1rem+1.5vw,2.4rem)] font-semibold leading-[1.1] text-muted lg:col-span-6">
          Questions people ask
        </h2>
      </div>
      <dl>
        {items.map((f) => (
          <div key={f.q} data-reveal className="grid-12 mt-14 gap-y-3 lg:mt-20">
            <dt className="col-span-12 text-[clamp(1.5rem,1.1rem+1.5vw,2.4rem)] font-semibold leading-[1.1] text-ink lg:col-span-6">{f.q}</dt>
            <dd className="col-span-12 max-w-[42ch] text-[1.0625rem] leading-relaxed text-muted lg:col-span-5 lg:col-start-8 lg:pt-1.5">{f.a}</dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}
