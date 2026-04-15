import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.menu_items.findMany({
    where: { active: true },
    orderBy: [{ category_id: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      base_price: true,
      image_url: true,
      prep_time_minutes: true,
      kitchen_section: true,
      category_id: true,
      menu_categories: {
        select: { id: true, name: true, display_order: true },
      },
    },
  });

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      basePrice: Number(i.base_price),
      imageUrl: i.image_url,
      prepTimeMinutes: i.prep_time_minutes,
      kitchenSection: i.kitchen_section,
      category: {
        id: i.menu_categories.id,
        name: i.menu_categories.name,
        displayOrder: i.menu_categories.display_order,
      },
    })),
  });
}
