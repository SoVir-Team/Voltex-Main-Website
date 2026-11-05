import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="frame flex min-h-[70svh] flex-col justify-center py-24">
        <p className="monument text-[clamp(6rem,24vw,22rem)] leading-[0.8] text-surface-2" aria-hidden>
          404
        </p>
        <h1 className="mt-6 text-heading font-bold">This page is open circuit.</h1>
        <p className="mt-3 max-w-[30rem] text-muted">The link may be broken or the page may have moved.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className={buttonClass("primary")}>
            Go home
          </Link>
          <Link href="/our-products" className={buttonClass("ghost")}>
            Our products
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
