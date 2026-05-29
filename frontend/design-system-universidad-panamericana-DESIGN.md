# Design System Specification: The Digital Curator
 
## 1. Overview & Creative North Star
The "Digital Curator" represents a departure from the generic, grid-locked academic portal. This design system is built on the philosophy of **Institutional Authority through Editorial Elegance**. We are not simply building an interface; we are curating an academic legacy. 
 
The Creative North Star is defined by **Intentional Asymmetry and Tonal Depth**. By utilizing high-contrast typography scales (the prestige of Public Sans against the utility of Inter) and breaking the "template" look with overlapping elements and generous white space, we move the experience from "software" to "digital monograph." We prioritize breathing room over information density, ensuring every piece of content feels intentional and permanent.
 
---
 
## 2. Color Theory & Surface Logic
The palette is rooted in the Universidad Panamericana heritage, but applied with a modern, layered sophistication. 
 
### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section sitting on a `surface` background provides all the definition required. This creates a high-end, seamless "wash" of color rather than a boxed-in, "Excel-sheet" appearance.
 
### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine cotton paper. 
*   **Base:** `surface` (#F9F9F9)
*   **Nesting:** Use `surface-container` tiers (Lowest to Highest) to define importance. An inner card should use `surface-container-lowest` (#ffffff) to "pop" against a `surface-container-low` (#f3f3f3) background.
 
### The "Glass & Gradient" Rule
To avoid a flat, dated look, use **Glassmorphism** for floating navigation or contextual overlays. Use semi-transparent `surface` colors with a `backdrop-blur` of 12px–20px. 
*   **Signature Textures:** For primary CTAs or Hero sections, apply a subtle linear gradient from `primary` (#6C0128) to `primary-container` (#8C1F3D) at a 135-degree angle. This adds "soul" and depth that a flat hex code cannot achieve.
 
---
 
## 3. Typography: The Academic Dialogue
The interplay between **Public Sans** and **Inter** creates a dialogue between tradition and progress.
 
*   **Display & Headline (Public Sans):** Used for titles that require gravitas. The high x-height and sharp serifs convey the "Curator" persona. Use `display-lg` (3.5rem) with tighter letter-spacing (-0.02em) for a truly editorial feel.
*   **Titles & Body (Inter):** Used for functional navigation and long-form reading. Inter provides the modern, legible contrast to the traditional Serif.
*   **The Scale:** 
    *   **Display-lg:** 3.5rem (Public Sans) — Leading: 1.1
    *   **Headline-md:** 1.75rem (Public Sans) — Leading: 1.2
    *   **Body-lg:** 1rem (Inter) — Leading: 1.5 (Optimized for readability)
    *   **Label-sm:** 0.6875rem (Inter, All-Caps, Tracking: 0.05em) — Used for metadata.
 
---
 
## 4. Elevation & Depth
We eschew traditional material shadows in favor of **Tonal Layering**.
 
*   **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card placed on a `surface-container-low` section creates a natural, soft lift.
*   **Ambient Shadows:** If a floating element (like a modal) is required, use a "Ghost Shadow."
    *   *Values:* `0px 24px 48px rgba(26, 28, 28, 0.06)`. 
    *   The shadow is ultra-diffused and tinted with the `on-surface` color to mimic natural ambient light.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline-variant` at **15% opacity**. 100% opaque borders are strictly forbidden as they break the "editorial wash."
 
---
 
## 5. Components
 
### Buttons
*   **Primary:** Gradient fill (`primary` to `primary-container`), White text, `md` (0.375rem) corner radius. No shadow.
*   **Secondary:** Ghost style. No background, `primary` text, with a subtle `surface-container-high` hover state.
*   **Tertiary/Gold:** Use `secondary` (#765A24) for high-prestige callouts, such as "Apply Now" or "Donate," to provide a "Gold Accent" feel.
 
### Cards & Lists
*   **Forbidden:** Horizontal divider lines.
*   **Layout:** Separate list items using `1.5rem` (Spacing 6) of vertical white space or a 2% tonal shift in background color.
*   **Interaction:** On hover, a card should transition from `surface-container-lowest` to `surface-bright`, accompanied by the "Ambient Shadow."
 
### Input Fields
*   **Styling:** Filled style only (using `surface-container-high`). No bottom line. Use a `3px` left-accent border in `primary` (#6C0128) only when the field is focused.
*   **Typography:** Labels use `label-md` in `on-surface-variant`.
 
### Academic Hero (Custom Component)
*   A large-scale component featuring a `display-lg` Public Sans title, overlapping a `primary-container` colored block, with a `secondary` (Gold) accent line (2px height, 40px width) to signify institutional prestige.
 
---
 
## 6. Do's and Don'ts
 
### Do
*   **Use Intentional White Space:** If you think there is enough space, add 25% more. High-end design requires room to breathe.
*   **Nesting Surfaces:** Always place lighter containers on darker backgrounds to create a sense of physical protrusion.
*   **Asymmetric Grids:** Align text to the left but allow imagery to break the grid or bleed off-edge for an editorial look.
 
### Don't
*   **No 1px Borders:** Never use a solid line to separate sections. Use color.
*   **No Pure Black:** Use `on-surface` (#1a1c1c) for text to maintain a softer, premium contrast.
*   **No Default Shadows:** Avoid the standard "drop shadow" look. If it looks like a template, it’s wrong.
*   **No Tight Leading:** Never collapse the line-height on Public Sans; it needs space to maintain its authoritative "Curator" voice.