"use client";

import { motion } from "framer-motion";
import type { SlideshowItem } from "./types";

interface HeroSlideProps {
  item: SlideshowItem;
}

export function HeroSlide({ item }: HeroSlideProps) {
  return (
    <motion.div
      key={item.id}
      className="absolute inset-0"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Full-bleed hero image. object-position keeps the dish near the top-center
          so it doesn't get hidden under the copy gradient at the bottom. */}
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: item.objectPosition }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, #2a2a2a 0%, #1c1b1b 45%, #0e0e0e 100%)",
          }}
        />
      )}

      {/* Bottom-to-top gradient for text legibility. Transparent in the top 40%
          so the dish reads cleanly, opaque near the bottom where the copy sits. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(14,14,14,0.95) 0%, rgba(14,14,14,0.75) 30%, rgba(14,14,14,0.25) 55%, rgba(14,14,14,0) 80%)",
        }}
      />

      {/* Copy block — anchored bottom-left on desktop, centered on mobile */}
      <div className="absolute inset-x-0 bottom-0 px-8 pb-28 md:px-16 md:pb-32">
        <div className="mx-auto max-w-5xl md:mx-0">
          <span className="mb-4 block font-label text-xs font-semibold uppercase tracking-[0.4em] text-primary md:text-sm">
            Ember &amp; Oak
          </span>
          <h1 className="mb-5 font-headline text-5xl leading-[1.05] text-on-surface md:text-7xl lg:text-8xl">
            {item.name}
          </h1>
          {item.description ? (
            <p className="mb-8 max-w-2xl font-body text-base font-light leading-relaxed text-on-surface-variant md:text-lg">
              {item.description}
            </p>
          ) : null}
          <div className="primary-gradient-btn inline-block text-xs font-extrabold uppercase tracking-[0.25em] md:text-sm">
            Tap anywhere to join the waitlist
          </div>
        </div>
      </div>
    </motion.div>
  );
}
