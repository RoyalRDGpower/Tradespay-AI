# Design System Strategy: Supreme Pro Dark

## 1. Overview & Creative North Star: "The Kinetic Noir"
This design system is built for the high-stakes world of 'TradesPay AI'. Our Creative North Star is **"The Kinetic Noir."** We are moving away from the "generic SaaS" look to create an environment that feels like a precision instrument—authoritative, high-performance, and ruthlessly efficient.

We break the "template" look by using a **Strict Minimalist Hierarchy**. By leveraging extreme contrast—the void of `#080808` against the kinetic energy of Neon Orange—we create a UI that feels less like a webpage and more like a tactical heads-up display (HUD). Asymmetry is our friend; we use generous, intentional whitespace to let data breathe, ensuring the mobile PWA experience is never cluttered.

## 2. Colors: Tonal Depth & The Neon Pulse
Our palette is rooted in the "Deepest Black" to ensure maximum OLED efficiency and visual impact.

### The Palette
- **Background (`#131313` / `#080808`):** The canvas. Use the deepest values for the primary backdrop to make interactive elements "pop."
- **Primary (`#ff5c1a` / `primary-container`):** The Pulse. This is reserved exclusively for primary actions and critical status updates.
- **Surface Tiers:** We use `surface-container-lowest` (#0e0e0e) to `surface-container-highest` (#353534) to build depth.

### The "No-Line" Rule
**Borders are a failure of hierarchy.** Explicitly prohibit 1px solid borders for sectioning. To separate content, use a background shift. For example, a card (`surface-container-low`) should sit on the main `background` without an outline. The eye should perceive the edge via the color transition alone.

### Signature Textures: CSS Glows
Since we are keeping the PWA under 1MB, we forbid large images. Instead, use **CSS-based depth**:
- **Action Glows:** Primary buttons should have a subtle `0px 0px 15px rgba(255, 92, 26, 0.3)` box-shadow to simulate a neon hum.
- **Glassmorphism:** For floating navigation or modals, use a combination of `surface` at 80% opacity and `backdrop-filter: blur(12px)`.

## 3. Typography: Editorial Authority
We pair the aggressive, architectural geometry of **Space Grotesk** (serving as our 'Syne' alternative) with the invisible functionality of **Inter**.

- **Display & Headlines (Space Grotesk):** These are your "Statement" styles. Use `display-lg` for hero numbers and `headline-md` for section titles. Keep letter-spacing tight (-0.02em) to maintain a "Pro" feel.
- **Body & Labels (Inter):** High legibility is non-negotiable. Use `body-md` for standard text. In dark mode, avoid pure white for body text; use `on-surface-variant` (#e4beb3) to reduce eye strain and create a sophisticated "muted" look.

## 4. Elevation & Depth: Tonal Layering
In this system, depth is not "up and down," it is "light and dark."

- **The Layering Principle:** Stack your surfaces.
    1. Base: `surface` (#131313)
    2. Section: `surface-container-low` (#1c1b1b)
    3. Interactive Card: `surface-container-highest` (#353534)
- **Ambient Shadows:** Standard drop shadows are too "web 2.0." Use extra-diffused, tinted shadows. A floating card should use a shadow color derived from the primary orange at 4% opacity to create a "warm" lift.
- **The "Ghost Border" Fallback:** If a divider is mandatory for accessibility, use the `outline-variant` token at **10% opacity**. It should be felt, not seen.

## 5. Components: Precision Utilitarianism

### Buttons
- **Primary:** Background: `primary-container` (#ff5c1a); Text: `on-primary` (#5d1900). Bold, all-caps, 0.25rem (sm) radius.
- **Secondary:** Background: `transparent`; Border: `Ghost Border` (outline-variant @ 20%).
- **Tertiary:** Text-only with an underline that appears on hover/active states.

### Cards & Lists
- **The Divider Ban:** Never use `<hr>` or border-bottom. Use a `16px` vertical gap or a subtle background shift to `surface-container-low`.
- **Data Points:** In list items, the "Label" should be `label-sm` in `on-surface-variant`, while the "Value" should be `title-md` in `on-surface` for high-speed scanning.

### Input Fields
- **Tactile Inputs:** Use `surface-container-highest` as the input background. No bottom border. When focused, the only change should be a 1px neon orange glow (`primary`) on the left edge of the input.

### Tactical Chips
- Small, rectangular, `0.125rem` radius. Use `secondary-container` for neutral states and `tertiary-container` for AI-assisted insights.

## 6. Do’s and Don’ts

### Do:
- **Embrace the Dark:** Use the deepest black for the majority of the UI to save battery on mobile devices.
- **Use Intentional Asymmetry:** Align text to the left but allow large data visualizations to bleed to the right edge.
- **Micro-interactions:** Use fast (150ms) "Spring" easing for button presses to make the PWA feel native.

### Don't:
- **No Gradients:** Avoid heavy multi-stop gradients. If needed, use a simple linear-gradient from `primary` to `primary-container` only.
- **No Rounded Corners:** Avoid "pill" shapes (except for specific status chips). Keep the `roundedness-scale` to `sm` (0.125rem) or `none` to maintain a sharp, professional edge.
- **No Full-Opacity Borders:** These clutter the UI and break the "Kinetic Noir" immersion.