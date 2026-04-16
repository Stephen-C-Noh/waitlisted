import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MenuClient } from "./MenuClient";

export const dynamic = "force-dynamic";

/** Map kitchen_section to display categories per plan §7. */
const SECTION_TO_CATEGORY: Record<string, string> = {
  APPETIZER: "Appetizers",
  GRILL: "Mains",
  SAUTE: "Mains",
  FRYER: "Mains",
  COLD: "Mains",
  DESSERT: "Desserts",
};

const CATEGORY_ORDER: Record<string, number> = {
  Appetizers: 0,
  Mains: 1,
  Desserts: 2,
};

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  kitchenSection: string;
  category: string;
}

interface Props {
  params: Promise<{ token: string }>;
}

export default async function MenuPage({ params }: Props) {
  const { token } = await params;

  // Validate token
  const entry = await prisma.waitlist_entries.findUnique({
    where: { access_token: token },
    select: { id: true, status: true, guest_name: true },
  });

  if (!entry) notFound();

  // Reject CANCELLED/SEATED
  if (entry.status === "CANCELLED" || entry.status === "SEATED") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="font-headline text-3xl text-on-surface">
            Menu Unavailable
          </h1>
          <p className="font-body text-on-surface-variant">
            {entry.status === "SEATED"
              ? "You've been seated! Your server will assist you with ordering."
              : "This reservation has been cancelled."}
          </p>
        </div>
      </main>
    );
  }

  // Fetch menu items
  const rows = await prisma.menu_items.findMany({
    where: { active: true },
    orderBy: [{ kitchen_section: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      base_price: true,
      image_url: true,
      kitchen_section: true,
    },
  });

  const items: MenuItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    basePrice: Number(r.base_price),
    imageUrl: r.image_url,
    kitchenSection: r.kitchen_section,
    category: SECTION_TO_CATEGORY[r.kitchen_section] ?? "Other",
  }));

  // Group by category and sort
  const categories = Object.entries(
    Object.groupBy(items, (i) => i.category),
  )
    .map(([name, catItems]) => ({
      name,
      items: catItems ?? [],
    }))
    .sort(
      (a, b) =>
        (CATEGORY_ORDER[a.name] ?? 99) - (CATEGORY_ORDER[b.name] ?? 99),
    );

  // Load existing pre-order if any
  const preOrder = await prisma.pre_orders.findUnique({
    where: { waitlist_entry_id: entry.id },
    include: {
      items: {
        select: {
          menu_item_id: true,
          quantity: true,
          special_instructions: true,
          unit_price: true,
        },
      },
    },
  });

  const existingItems = preOrder
    ? preOrder.items.map((i) => {
        const menuItem = items.find((m) => m.id === i.menu_item_id);
        return {
          menuItemId: i.menu_item_id,
          name: menuItem?.name ?? "Unknown",
          unitPrice: Number(i.unit_price),
          quantity: i.quantity,
          specialInstructions: i.special_instructions ?? undefined,
        };
      })
    : [];

  return (
    <MenuClient
      token={token}
      guestName={entry.guest_name}
      categories={categories}
      existingItems={existingItems}
      preOrderStatus={preOrder?.status ?? null}
    />
  );
}
