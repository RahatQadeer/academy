# Whitby Design System

Built in a Notion-inspired visual language: warm off-white canvas, near-black ink text, one blue accent, sharp sans-serif type, minimal shadows, thin 1px borders instead of heavy cards.

---

## 1. Foundations

**Typeface:** system sans-serif stack only, no webfont load.
```
font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

**Base text color:** `#37352f` (Notion's warm near-black — never pure `#000`).
**Page/canvas background:** `#f1f1ef`.
**Card/surface background:** `#ffffff`.

**Links:** default `#2383e2`, hover `#1a6bbd`. Always declare both at the global level even before links exist on a page.

### Color tokens

| Token | Value | Usage |
|---|---|---|
| Ink | `#37352f` | body text, headings, dark buttons/badges, logo mark |
| Accent | `#2383e2` | primary buttons, links, active nav, focus/selected borders |
| Accent hover | `#1a6bbd` | link hover only |
| Accent tint bg | `#e7f1fb` / `#f4f9fe` / `#fbfdff` | icon chips, selected-card backgrounds |
| Canvas | `#f1f1ef` | app/page background |
| Surface | `#ffffff` | cards, modals, panels |
| Surface soft | `#f7f7f5` | sidebars, code-style top bars, secondary sections |
| Surface subtle | `#fbfbfa` | quote/callout blocks |
| Border | `#ececea` | default card/table/divider border |
| Border strong | `#d9d9d6` | input borders, toggle-off track |
| Border dashed | `#e3e3e0` | disabled/inactive card outline |
| Text secondary | `rgba(55,53,47,.6)` – `rgba(55,53,47,.65)` | body copy, descriptions |
| Text tertiary | `rgba(55,53,47,.45)` – `rgba(55,53,47,.5)` | meta, captions, timestamps |
| Text disabled | `rgba(55,53,47,.3)` – `rgba(55,53,47,.35)` | inactive labels |
| Success bg/fg | `#d6ecd8` / `#1c7a52` or `#2e6b3a` | done checkmarks, on-time stats, "Available" |
| Warning bg/fg | `#fdf7ee` bg, `#f2e2ca` border, `#7a5a2e`/`#8a6229` fg | approval-needed banners, "waiting on you" |
| Danger bg/fg | `#ffe2dd` / `#5d1715` | "at risk" status pill |
| Info bg/fg | `#d3e5ef` / `#183347` | "Running" status pill, run counters |
| Avatar tan | bg `#f1e9db`, fg `#8a6f3e` | default person avatar |
| Avatar blue-gray | bg `#dbe9f1`, fg `#2d4a5e` | alt avatar (testimonial) |
| Module: OS blue | bg `#e7f1fb`, fg `#2383e2` | Whitby OS icon |
| Module: Portal tan | bg `#f1e9db`, fg `#8a6f3e` | Client Portal icon |
| Module: Academy purple | bg `#e9e4f3`, fg `#6b4fa8` | Academy icon |
| Module: Partner green | bg `#e7f2ea`, fg `#2d6a4f` | Partner Center icon / switcher accent |

Dark section (footer CTA) inverts to `#37352f` background, white text at `rgba(255,255,255,.65)` for secondary copy, `rgba(255,255,255,.28)` for borders.

### Type scale

| Use | Size / weight / tracking |
|---|---|
| Hero H1 | 60px / 700 / -1.6px, line-height 1.06 |
| Section H2 | 34–38px / 700 / -.7 to -.9px |
| Screen H1 (auth/onboarding) | 28–32px / 700 / -.4 to -.5px |
| Card/module title | 15–16px / 600 |
| Body / description | 14–18px / 400, color secondary, line-height 1.5–1.65 |
| Label (form labels, eyebrows) | 12–12.5px / 500–600, often uppercase with `.05–.06em` tracking, tertiary color |
| Meta / caption | 11.5–13px / 400–500, tertiary color |
| Big stat number | 40px / 700 / -1px |

Always add `text-wrap: pretty` on headings/long paragraphs that wrap.

### Spacing & shape

- Section horizontal padding on marketing page: `56px`. Vertical rhythm between sections: `80–96px`.
- Card border-radius: `8–10px`. Small controls (buttons, inputs, pills): `6px`. Avatars: `50%`. Small icon swatches: `8–9px` radius.
- Card border: `1px solid #ececea` as the default container border everywhere (nav items, table rows, grid cards) — borders do the separating, not shadows.
- Shadow use is minimal and only for elevated/floating surfaces: outer page card `0 1px 3px rgba(15,15,15,.1)`; dropdown/plan card `0 6px 20px rgba(15,15,15,.06)` or `0 12px 40px rgba(15,15,15,.08)` for the hero product screenshot.
- Buttons: `padding: 9–11px 15–22px`, `border-radius: 6px`, `font-size: 14–15px`, `font-weight: 500`. Primary = solid `#2383e2` (or `#37352f` for neutral/dark actions) with white text. Secondary = `1px solid #d9d9d6` with transparent background.

---

## 2. Core components

**Logo mark:** 20–38px square, `border-radius` ~40% of size, `background:#37352f`, white bold "W", centered.

**Top nav (marketing):** sticky, `border-bottom:1px solid #f1f1ef`, logo + wordmark, inline nav links at `rgba(55,53,47,.7)`, right-aligned "Sign in" text + dark solid CTA pill.

**App sidebar (product surfaces):** fixed width 186–232px, `background:#f7f7f5`, `border-right:1px solid #ececea`, workspace/product switcher row at top, nav items as `13.5–14px` rows with `6px` radius, active/current item gets `background:#efefed;font-weight:600`, icons `15px` `currentColor` at `rgba(55,53,47,.65)` when inactive. Section labels (e.g. "Workspace", "Recent") are `11.5px/600` tertiary, uppercase-style spacing not required (sentence case used here). User row pinned to bottom with `border-top`.

**Buttons:** see spacing section above. Toggle switch: `34×20px` track, `border-radius:10px`, `background:#2383e2` (on) or `#e0e0dd` (off), `16px` white circle knob.

**Status/kind pill:** `font-size:10.5–12.5px; font-weight:500; border-radius:4px; padding:2px 7-9px;` colored per the semantic tokens above (Auto=green, Approval=warning tan, Manual=gray, Active=info blue, At risk=danger).

**Step/plan row** (used in OS plan card, drafted-plan screen, run-in-progress screen): numbered circle (outline, 17–20px) or checkmark SVG (`#1c7a52`) when done → title (14–14.5px/500) + optional detail line (13px, tertiary) → right-aligned kind pill and/or timestamp.

**Callout/banner:** `border-radius:6–8px`, colored border+bg pair from the semantic tokens, small icon + text, used for tips ("Based on family office…") and approval warnings ("Waiting on you").

**Module/surface card** (five-surface grid, product switcher): `1px solid #ececea` default, `1.5px solid #37352f` or `#2383e2` + tinted bg when "current"/selected, dashed `#e3e3e0` border + muted icon/text when inactive/not-applied (Partner Program pattern). Icon swatch 34–38px, `8–9px` radius, tinted background per module color above.

**Form input:** `border:1px solid #d9d9d6; border-radius:6px; padding:9px 12px; font-size:14.5px;` label above at 12.5px/500 tertiary.

**Chip/tag select** (onboarding "what does your team do"): unselected = `1px solid #ececea`, secondary text; selected = `1px solid #2383e2; background:#f4f9fe; color:#1a6bbd`.

**Progress bar:** `height:4px; border-radius:2px; background:#ececea` track, `background:#2383e2` fill.

**Avatar:** circular, initials, tinted bg per the avatar tokens, bold small caps text.

**Trust marquee:** logotype row, infinite horizontal scroll via duplicated content + `translateX(-50%)` keyframe, edges masked with a horizontal `linear-gradient` fade (`mask-image`), font `17px/600` at `rgba(55,53,47,.28)`.

---

## 3. Screen inventory (current file)

| # | Label | Purpose |
|---|---|---|
| 00 | Landing page | Nav, hero, product screenshot (dashboard mock), logo marquee, 5-surface grid, OS explainer split (copy + drafted-plan card), stats row, testimonial, dark CTA footer, footer nav |
| 01 | Sign in | Email + code CTA, Google/SSO alt options, terms, right-side social-proof panel (quote + stats) |
| 02 | Verify code | 6-digit code input, resend/expiry, security note |
| 03 | Onboarding: create workspace | Breadcrumb + step 1/3 progress, workspace name/URL, team-type chip select |
| 04 | Onboarding: choose modules | Step 2/3, module toggle cards (Requests/Playbooks/Portal on, Reports off), playbook auto-suggest callout |
| 05 | Product switcher | Grid of 5 surface cards (PA current, OS, Portal, Academy active; Partner Program inactive/apply state), add-workspace row |
| 06 | Whitby OS — start a workflow | App sidebar + centered prompt box, attach/playbook/client chips, "start from a playbook" grid |
| 07 | Whitby OS — review drafted plan | Chat-style request bubble → 6-step plan list → approval-needed callout → Run/Save actions |
| 08 | Whitby OS — run in progress | Progress header, step list with done/active/idle states, "waiting on you" approval card, right rail with context + activity feed + ask-about-this-run box |

Skipped: a third onboarding step (team invite) — noted as an open item.

---

## 4. Content & tone

- Copy is plain, operational, specific to a private-client/concierge-services audience (family offices, relocation, board decks). Avoid generic SaaS language.
- Numbers in stats/testimonials are concrete and specific ("9 → 2 days", "82%"), not vague claims.
- UI microcopy stays terse: button labels are 1-3 words, step details are one line.

## 5. What NOT to introduce

- No webfonts, no gradients, no emoji, no heavy drop shadows, no rounded-pill everything, no left-border accent cards.
- Max one accent color (`#2383e2`) — every other color is a semantic status tint or a neutral.
- Don't invent new module icon colors; reuse the palette above for any new surface.
- Keep all styling inline per component (this file is built as a Design Component — no external stylesheets).

---

## 6. Notes for this build (added by Laiba's base setup)

6.1 This design system currently names the platform module "Whitby OS" and uses "PA" / a generic "W" logo mark. Per the current product direction (see SRS Section 1), the correct terminology is: **Private Attaché** is the master brand and app shell (upper-left branding, logo mark); **Whitby** is the AI coordination layer/assistant referenced through actions like "Ask Whitby," "Build with Whitby." The module is called **WhitbyOS is incorrect — use "Whitby"** in-product; do not use "Whitby OS" as a product name anywhere in new screens. Update the logo mark concept accordingly: the "W" mark and dark-square treatment can stay as the Private Attaché app icon, but any screen label reading "Whitby OS" should be corrected to "Whitby" per brand direction.

6.2 The five-surface product switcher grid (screen 05) should be re-labeled to match the actual four products plus the switcher's own "current" state: Whitby (professional platform), Client Portal, Academy, Partner Center — "Partner Program" should read "Partner Center." There is no fifth generic "PA" surface; Private Attaché is the umbrella the switcher itself lives in, not a fifth selectable square.

6.3 Module icon color assignments to use going forward: Whitby = OS blue token; Client Portal = Portal tan token; Academy = Academy purple token (Academy and the LMS share this same color, since they are one module with two surfaces); Partner Center = Partner green token.

6.4 This design system file is the single source of truth for visual styling across all four module teams. Every screen built by every team must be checked against Section 1 (foundations), Section 2 (core components), Section 4 (tone), and Section 5 (what not to introduce) before being considered complete.
