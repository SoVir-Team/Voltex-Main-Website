import Image from "next/image";
import type { Photo } from "@/lib/credits";

/** The page's one rest: a full-width moving picture (muted loop with a poster), or a photograph that drifts slowly. */
export function PhotoBand({ photo, video, caption }: { photo?: Photo; video?: { src: string; poster: string; label: string }; caption: string }) {
  return (
    <figure className="relative">
      <div className="relative h-[clamp(14rem,38vw,34rem)] overflow-hidden bg-surface">
        {video ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={video.src}
            poster={video.poster}
            aria-label={video.label}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : photo ? (
          <Image src={photo.src} alt={photo.alt} fill quality={85} sizes="100vw" className="drift object-cover" />
        ) : null}
      </div>
      <figcaption className="frame mt-3 text-small text-muted">{caption}</figcaption>
    </figure>
  );
}
