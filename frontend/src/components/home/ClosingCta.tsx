import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";

/** The close inverts the page and returns to the idea: your product, built. */
export function ClosingCta({
  title = "Have an idea? Let’s build it.",
  body = "Tell us what you want to make. An engineer will reply within one working day.",
  href = "/bring-your-idea",
  action = "Bring your idea",
}: {
  title?: string;
  body?: string;
  href?: string;
  action?: string;
}) {
  return (
    <Reveal as="section" aria-labelledby="cta-title" className="bg-ink-deep text-on-ink">
      <div className="frame flex min-h-[80svh] flex-col justify-between py-[clamp(5rem,10vw,9rem)]">
        <h2 id="cta-title" data-reveal className="monument max-w-[14ch] text-[clamp(2rem,8.2vw,9.5rem)] leading-[0.92]">
          {title}
        </h2>
        <div className="mt-16 flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <p data-reveal className="max-w-[30rem] text-lead text-on-ink-muted">
            {body}
          </p>
          <div data-reveal>
            <ButtonLink href={href} variant="bolt" arrow className="min-h-14 w-full px-8 sm:w-auto">
              {action}
            </ButtonLink>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
