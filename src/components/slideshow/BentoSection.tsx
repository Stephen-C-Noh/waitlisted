import type { SlideshowItem } from "./types";

interface BentoSectionProps {
  items: SlideshowItem[];
}

export function BentoSection({ items }: BentoSectionProps) {
  if (items.length === 0) return null;
  const [featured, secondary] = items;

  return (
    <section className="bg-surface-container-low px-8 py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-12">
        <BentoCard item={featured} className="md:col-span-8 aspect-[16/9]" />
        {secondary ? (
          <BentoCard
            item={secondary}
            className="md:col-span-4 aspect-square md:aspect-auto"
          />
        ) : null}
      </div>
    </section>
  );
}

function BentoCard({
  item,
  className,
}: {
  item: SlideshowItem;
  className: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl bg-surface-container-high ${className}`}
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background:
              "linear-gradient(135deg, #2a2a2a 0%, #1c1b1b 60%, #0e0e0e 100%)",
          }}
        />
      )}
      <div className="absolute bottom-8 left-8 right-8">
        <h3 className="font-headline text-3xl uppercase tracking-tight text-on-surface">
          {item.name}
        </h3>
        {item.description ? (
          <p className="mt-2 font-body text-xs uppercase tracking-widest text-on-surface-variant line-clamp-1">
            {item.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
