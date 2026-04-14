# Design System: High-End Editorial Waitlist Experience

## 1. Overview & Creative North Star: "The Digital Maître D’"
This design system is built to transform a functional waitlist into a high-end concierge experience. Our Creative North Star is **"The Digital Maître D’"**—an interface that feels as poised, intentional, and welcoming as a host at a Michelin-starred establishment. 

To achieve this, we move away from "app-like" density. Instead, we utilize **Editorial Asymmetry**. By pairing the expansive `notoSerif` headings with generous `16 (5.5rem)` or `20 (7rem)` spacing, we create a rhythm that feels curated rather than automated. Elements should feel "placed" on the screen, often overlapping slightly (e.g., a `surface-container-high` card partially overlapping a `surface-container` section) to create a sense of bespoke architectural depth.

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in `background: #131313`, a deep charcoal that provides a canvas for sophisticated layering.

*   **Primary Accent (The Gold):** Use `primary: #e9c176` sparingly. It is a signature, not a utility. Use it for the most critical CTAs or to highlight a guest's VIP status.
*   **Tertiary Accent (The Sage):** Use `tertiary: #b8ccb8` for "Confirmed" states or organic successes. It provides a cooling contrast to the warmth of the gold and wood tones.
*   **The "No-Line" Rule:** Under no circumstances are 1px solid borders to be used for sectioning. Structural definition must be achieved through:
    *   **Background Shifts:** Place a `surface-container-low` component on a `surface` background.
    *   **Tonal Nesting:** An inner guest detail panel should use `surface-container-highest` to sit atop a `surface-container` list item.
*   **The "Glass & Gradient" Rule:** For primary CTAs, do not use flat fills. Apply a subtle linear gradient from `primary` to `primary_container` at a 45-degree angle. For floating overlays (like guest notifications), use `surface_container_highest` at 80% opacity with a `backdrop-blur` of 12px to create a frosted glass effect.

## 3. Typography: The Editorial Voice
We contrast the authoritative, timeless nature of a serif with the modern precision of a geometric sans-serif.

*   **The Signature (Display & Headline):** `notoSerif` is our voice of heritage. Use `display-lg` for "Time to Table" or empty states. Use `headline-sm` for guest names. Ensure a generous `line-height` to let the serifs breathe.
*   **The Utility (Title, Body, Label):** `manrope` handles the logistics. It must be used for wait times, party sizes, and button labels.
*   **Hierarchy Tip:** Pair a `headline-md` (Serif) name with a `label-md` (Sans-serif) phone number directly below it. The shift in font family creates an immediate, intuitive distinction between "Identity" and "Data."

## 4. Elevation & Depth: Atmospheric Layering
Forget the concept of "Level 1-5" shadows. We use **Tonal Layering** to convey hierarchy.

*   **The Layering Principle:** 
    *   Base: `surface` (#131313)
    *   Section: `surface-container-low`
    *   Card: `surface-container-high`
    *   Active/Pop-out: `surface-container-highest`
*   **Ambient Shadows:** If an element must float (e.g., a "New Reservation" modal), use a shadow with a blur of `xl` and a 6% opacity. The shadow color should be derived from `on_surface` (tinted dark), creating a soft "glow" of darkness rather than a harsh drop shadow.
*   **The Ghost Border:** If accessibility requires a container edge (e.g., input fields), use the `outline_variant` token at **15% opacity**. It should be felt, not seen.

## 5. Components: Bespoke Elements
*   **The Waitlist Card:** Forbidden: horizontal dividers. Instead, use a `3 (1rem)` vertical gap between cards and a `surface-container` background. Use `lg (1rem)` rounding for a soft, premium touch.
*   **Action Buttons:** Primary buttons use the Primary-to-Container gradient. Padding should be generous: `3 (1rem)` vertical and `6 (2rem)` horizontal.
*   **Status Chips:** Use `secondary_container` with `on_secondary_container` text. For VIPs, use `primary_fixed` with `on_primary_fixed`. Shapes should always be `full (9999px)` for a pill-like softness.
*   **Input Fields:** Treat these like stationery. Use a `surface_container_lowest` background with a `Ghost Border`. The label should be `label-md` in `on_surface_variant`.
*   **Concierge "Live" Indicator:** A pulse animation using the `tertiary` (Sage) color to indicate a guest is currently checking in, using a soft glow effect.

## 6. Do’s and Don’ts
### Do:
*   **Use White Space as a Luxury:** Give guest names room to "own" their row. Use `spacing.8` to separate major UI sections.
*   **Embrace Asymmetry:** Align the restaurant logo to the far left and the "Check-in" CTA to the far right, leaving a wide, quiet void in the center.
*   **Use Subtle Transitions:** When a guest moves from "Waiting" to "Seated," use a soft fade-and-slide transition rather than a "pop."

### Don’t:
*   **Don't use 100% white:** Use `on_surface` (#e5e2e1). Pure white (#ffffff) is too harsh for the sophisticated "Deep Charcoal" environment.
*   **Don't use Dividers:** If you feel the need for a line, try increasing the vertical spacing or shifting the background tone by one tier instead.
*   **Don't Overuse Gold:** If everything is gold, nothing is premium. Save `primary` for the "Moment of Truth" (e.g., "Table is Ready").

---
*Director's Note: This system is about the "hush" of a high-end dining room. Every pixel should feel quiet, confident, and expensive. When in doubt, add more space and remove a line.*