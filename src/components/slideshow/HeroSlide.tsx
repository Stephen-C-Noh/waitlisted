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
      {/* Background: image when available, otherwise a warm tonal gradient */}
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover brightness-[0.5]"
        />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, #2a2a2a 0%, #1c1b1b 45%, #0e0e0e 100%)",
          }}
        />
      )}

      {/* Editorial overlay */}
      <div className="absolute inset-0 flex items-center justify-center px-8">
        <div className="glass-panel max-w-4xl p-12 text-center md:p-16">
          <span className="mb-6 block font-label text-xs font-semibold uppercase tracking-[0.4em] text-primary md:text-sm">
            The Digital Maître D&rsquo;
          </span>
          <h1 className="mb-6 font-headline text-5xl leading-tight text-on-surface md:text-8xl">
            {item.name}
          </h1>
          {item.description ? (
            <p className="mx-auto mb-10 max-w-2xl font-body text-lg font-light leading-relaxed text-on-surface-variant md:text-xl">
              {item.description}
            </p>
          ) : null}
          <div className="primary-gradient-btn inline-block text-sm font-extrabold uppercase tracking-[0.2em] md:text-base">
            Tap anywhere to join the waitlist
          </div>
        </div>
      </div>
    </motion.div>
  );
}
