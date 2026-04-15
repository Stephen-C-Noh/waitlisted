import { prisma } from "@/lib/prisma";
import { SlideshowContainer } from "@/components/slideshow/SlideshowContainer";
import type { SlideshowItem } from "@/components/slideshow/types";

// Always fetch fresh; the kiosk runs for long stretches and menu changes
// should propagate without a redeploy.
export const dynamic = "force-dynamic";

const MAX_SLIDES = 6;

export default async function SlideshowPage() {
  const rows = await prisma.menu_items.findMany({
    where: { active: true },
    orderBy: [{ base_price: "desc" }, { name: "asc" }],
    take: MAX_SLIDES,
    select: {
      id: true,
      name: true,
      description: true,
      base_price: true,
      image_url: true,
    },
  });

  const items: SlideshowItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    basePrice: Number(r.base_price),
    imageUrl: r.image_url,
  }));

  return <SlideshowContainer items={items} />;
}
