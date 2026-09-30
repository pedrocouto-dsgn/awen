---
version: alpha
name: Awen
description: A quiet, cinematic dark system for a private visual reference bank, built from two provided palettes that share one job each. The **graphite family** (Air Black #111111, Black Olive #3A3A3A, Dark Liver #4D4D4D, Gray #B7BABB, Pastel Blue #B4C7CC) is the structure - canvas, cards, hairlines and body text. The **blue family** (Deep Tide #1E3A52, Steel #4B708D, Mist #8EB0C9, Frost #CADCEA) is the atmosphere and the action - gradients, glows, selected states and the primary button. The canvas is near-black graphite holding frost-blue type; the top of every page is lit by a blue-into-graphite gradient. **Gradients are the brand signature**. Type is a single sans family at modest weights (display 500, body 400). Spacing follows an explicit 8px ladder. Soft 8-16px corners and glass surfaces (translucent graphite with backdrop blur) over an ambient blue canvas. The media is always the hero; the interface frames it.
colors:
  air-black: '#111111'
  black-olive: '#3A3A3A'
  dark-liver: '#4D4D4D'
  gray-x11: '#B7BABB'
  pastel-blue: '#B4C7CC'
  deep-tide: '#1E3A52'
  steel: '#4B708D'
  mist: '#8EB0C9'
  frost: '#CADCEA'
  primary: '#CADCEA'
  primary-hover: '#E3EDF5'
  primary-active: '#B4C7CC'
  on-primary: '#111111'
  canvas: '#111111'
  canvas-elevated: '#3A3A3A'
  surface-mid: '#4D4D4D'
  surface-soft: '#B7BABB'
  surface-pale: '#CADCEA'
  ink: '#CADCEA'
  body: '#B7BABB'
  body-accent: '#B4C7CC'
  muted: '#4D4D4D'
  hairline: '#3A3A3A'
  hairline-strong: '#4D4D4D'
  canvas-light: '#F4F6F7'
  surface-light: '#E6ECEE'
  ink-on-light: '#111111'
  body-on-light: '#4D4D4D'
  muted-on-light: '#6E7375'
  hairline-on-light: '#B4C7CC'
  focus-ring: '#CADCEA'
  semantic-info: '#8EB0C9'
  semantic-success: '#6FBF9F'
  semantic-warning: '#D9A441'
  semantic-danger: '#E5737D'
  scrim: 'rgba(17, 17, 17, 0.85)'
gradients:
  canvas: 'linear-gradient(180deg, #1E3A52 0%, #111111 60%)'
  glow: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(75, 112, 141, 0.45) 0%, rgba(17, 17, 17, 0) 70%)'
  card: 'linear-gradient(160deg, #3A3A3A 0%, #1A1A1A 100%)'
  dusk: 'linear-gradient(135deg, #1E3A52 0%, #3A3A3A 100%)'
  accent: 'linear-gradient(135deg, #B4C7CC 0%, #CADCEA 100%)'
  steel: 'linear-gradient(135deg, #1E3A52 0%, #2F5574 100%)'
  scrim: 'linear-gradient(180deg, rgba(17, 17, 17, 0) 0%, rgba(17, 17, 17, 0.85) 100%)'
  hairline: 'linear-gradient(90deg, rgba(75, 112, 141, 0) 0%, #4B708D 50%, rgba(75, 112, 141, 0) 100%)'
typography:
  display-mega:
    fontFamily: '''Inter'', -apple-system, system-ui, sans-serif'
    fontSize: 80px
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: '-1.6px'
  display-xl:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 56px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: '-1.12px'
  display-lg:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: '-0.36px'
  display-md:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 26px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0.195px
  title-md:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0
  title-sm:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.08px
  body-md:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  caption-uppercase:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 1.1px
    textTransform: uppercase
  button:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 1.4px
    textTransform: uppercase
  nav-link:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.65px
    textTransform: uppercase
  number-display:
    fontFamily: '''Inter'', sans-serif'
    fontSize: 80px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '-1.6px'
rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  xxxs: 4px
  xxs: 8px
  xs: 16px
  sm: 24px
  md: 32px
  lg: 48px
  xl: 64px
  xxl: 96px
  super: 128px
components:
  app-background:
    backgroundColor: '{colors.canvas}'
    backgroundImage: '{gradients.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
  top-bar:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.nav-link}'
    height: 64px
  sidebar:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.body}'
    typography: '{typography.nav-link}'
    width: 240px
    padding: 24px 16px
  nav-item:
    backgroundColor: transparent
    textColor: '{colors.body}'
    typography: '{typography.nav-link}'
    rounded: '{rounded.none}'
    height: 44px
    padding: 0 16px
  nav-item-active:
    backgroundColor: '{colors.canvas-elevated}'
    backgroundImage: '{gradients.steel}'
    textColor: '{colors.ink}'
    typography: '{typography.nav-link}'
    rounded: '{rounded.none}'
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.none}'
    padding: 14px 32px
    height: 48px
  button-primary-gradient:
    backgroundColor: '{colors.primary}'
    backgroundImage: '{gradients.accent}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.none}'
    padding: 14px 32px
    height: 48px
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.none}'
  button-primary-active:
    backgroundColor: '{colors.primary-active}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.none}'
  button-outline:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.none}'
    padding: 13px 31px
    height: 48px
  button-tertiary-text:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    typography: '{typography.button}'
  button-danger-outline:
    backgroundColor: transparent
    textColor: '{colors.semantic-danger}'
    typography: '{typography.button}'
    rounded: '{rounded.none}'
    padding: 13px 31px
    height: 48px
  hero-band-glow:
    backgroundColor: '{colors.canvas}'
    backgroundImage: '{gradients.glow}'
    textColor: '{colors.ink}'
    typography: '{typography.display-xl}'
    padding: 96px 48px
  media-card:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.none}'
    padding: 0
  media-card-overlay:
    backgroundImage: '{gradients.scrim}'
    textColor: '{colors.ink}'
    typography: '{typography.caption}'
    padding: 16px
  surface-card:
    backgroundColor: '{colors.canvas-elevated}'
    backgroundImage: '{gradients.card}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.none}'
    padding: 24px
  analysis-panel:
    backgroundColor: '{colors.canvas-elevated}'
    backgroundImage: '{gradients.dusk}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.none}'
    padding: 32px
  palette-swatch:
    backgroundColor: '{colors.dark-liver}'
    textColor: '{colors.ink}'
    typography: '{typography.caption}'
    rounded: '{rounded.none}'
    height: 48px
  stat-cell:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    typography: '{typography.number-display}'
    padding: 24px 0
  list-row:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    padding: 16px 0
  divider-accent:
    backgroundImage: '{gradients.hairline}'
    height: 1px
  text-input:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: 14px 16px
    height: 48px
  search-field:
    backgroundColor: '{colors.canvas-elevated}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: 0 16px
    height: 44px
  filter-chip:
    backgroundColor: transparent
    textColor: '{colors.body}'
    typography: '{typography.caption-uppercase}'
    rounded: '{rounded.none}'
    padding: 8px 12px
  filter-chip-active:
    backgroundColor: '{colors.canvas-elevated}'
    backgroundImage: '{gradients.steel}'
    textColor: '{colors.ink}'
    typography: '{typography.caption-uppercase}'
    rounded: '{rounded.none}'
    padding: 8px 12px
  badge-pill:
    backgroundColor: '{colors.canvas-elevated}'
    textColor: '{colors.ink}'
    typography: '{typography.caption-uppercase}'
    rounded: '{rounded.full}'
    padding: 4px 12px
  review-action-bar:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    height: 72px
    padding: 12px 32px
  player-controls:
    backgroundImage: '{gradients.scrim}'
    textColor: '{colors.ink}'
    typography: '{typography.caption}'
    padding: 16px
  progress-bar:
    backgroundColor: '{colors.canvas-elevated}'
    backgroundImage: '{gradients.accent}'
    height: 2px
  toast:
    backgroundColor: '{colors.canvas-elevated}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: 16px 24px
  modal:
    backgroundColor: '{colors.canvas-elevated}'
    backgroundImage: '{gradients.card}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.xl}'
    padding: 32px
  footer-dark:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.body}'
    typography: '{typography.body-sm}'
    padding: 64px 48px
source:
  type: custom
  origin: two palette images provided by the user. Blue five-tone (Abyss, Deep Tide, Steel, Mist, Frost; sampled from pixels) and graphite five-tone (Pastel Blue #B4C7CC, Black Olive #3A3A3A, Air Black #111111, Gray X11 #B7BABB, Dark Liver #4D4D4D; values read from the labels)
---

## Overview

Awen is a private visual reference bank, so the interface behaves like a dark gallery wall: images and videos are the light sources and the interface stays quiet around them. The system merges **two provided palettes with separate jobs**:

- **Graphite = structure.** Air Black (`{colors.canvas}` - #111111) is the floor. Black Olive (#3A3A3A) and Dark Liver (#4D4D4D) build cards, inputs and hairlines. Gray X11 (`{colors.body}` - #B7BABB) is running text.
- **Blue = atmosphere and action.** Deep Tide, Steel, Mist and Frost light the top of the page, tint selected states and fill the primary button. Frost (`{colors.primary}` - #CADCEA) is the single action color. Pastel Blue (#B4C7CC) bridges the two families: a soft text and icon tone, the pressed state and the start of the accent gradient.

The brand signature is **gradient**. The page floor fades from Deep Tide at the top into graphite, cards step from Black Olive into near-black, and featured panels blend blue into graphite (`{gradients.dusk}`). Gradients are built only from palette tones (plus one derived intermediate), never from new hues. Shadows are not a depth tool.

Type runs **Inter** at modest weights (display 500, body 400). CTA labels are uppercase with generous tracking. Spacing follows the 8px ladder. Corners are soft, on an 8-16px ladder; pill geometry is reserved for badges and avatars. Panels, the sidebar and the top bar are **glass**: translucent graphite with backdrop blur, floating 12px from the viewport edge over fixed blue glows.

**Key Characteristics:**
- Graphite structure: #111111, #3A3A3A, #4D4D4D, #B7BABB, #B4C7CC.
- Blue atmosphere: #1E3A52, #4B708D, #8EB0C9, #CADCEA.
- Near-black graphite canvas (never pure #000) lit by a blue gradient at the top.
- Primary CTA is Frost fill with Air Black text. No second brand hue.
- Gradients are a core visual element (8 named tokens), used with restraint.
- Single sans family: Inter. Display weight stays at 500.
- Soft corners: 10px on controls, 12-14px on media and menus, 16px on panels and modals.
- Glass surfaces (`glass`, `glass-strong`) over the ambient canvas.
- Media is the hero of every screen.
- Hairlines plus gradient brightness steps for depth. No drop shadow tiers.

## Colors

### The palettes (source of truth)
**Graphite family (structure)**
- **Air Black** (`{colors.air-black}` - #111111): page floor, text on primary buttons.
- **Black Olive** (`{colors.black-olive}` - #3A3A3A): cards, panels, inputs, hairlines.
- **Dark Liver** (`{colors.dark-liver}` - #4D4D4D): strong hairlines, swatch backing, disabled states.
- **Gray X11** (`{colors.gray-x11}` - #B7BABB): body text.
- **Pastel Blue** (`{colors.pastel-blue}` - #B4C7CC): soft accent text, icons, pressed state.

**Blue family (atmosphere and action)**
- **Deep Tide** (`{colors.deep-tide}` - #1E3A52): top of the page gradient, dusk and steel gradients.
- **Steel** (`{colors.steel}` - #4B708D): glows, gradient hairline. Decorative only.
- **Mist** (`{colors.mist}` - #8EB0C9): info color, secondary icons.
- **Frost** (`{colors.frost}` - #CADCEA): headings, primary text, primary button fill.

### Brand & Action
- **Primary** (`{colors.primary}` - #CADCEA): primary CTA fill.
- **Primary Hover** (`{colors.primary-hover}` - #E3EDF5): lighter step derived from Frost.
- **Primary Active** (`{colors.primary-active}` - #B4C7CC): pressed state, Pastel Blue.
- **On Primary** (`{colors.on-primary}` - #111111): Air Black on Frost (13.4:1).
- **Focus Ring** (`{colors.focus-ring}` - #CADCEA): 2px ring, 2px offset, on every interactive element.

### Text (contrast on Air Black unless noted)
- **Ink** (`{colors.ink}` - #CADCEA): display and strong text. 13.4:1 on canvas, 8.1:1 on Black Olive, 8.4:1 on Deep Tide.
- **Body** (`{colors.body}` - #B7BABB): running text. 9.7:1 on canvas, 5.8:1 on Black Olive, 6.0:1 on Deep Tide.
- **Body Accent** (`{colors.body-accent}` - #B4C7CC): links, tags, icon labels. 10.8:1 on canvas, 6.5:1 on Black Olive, 6.7:1 on Deep Tide.
- **Muted** (`{colors.muted}` - #4D4D4D): **not for readable text** (2.2:1). Only disabled states and strong hairlines.
- **Do not place Body (Gray) text on Dark Liver (4.3:1) or on the far end of the steel gradient (4.0:1).** Use Ink there.

### Light variant (derived)
- **Canvas Light** (`{colors.canvas-light}` - #F4F6F7), **Surface Light** (`{colors.surface-light}` - #E6ECEE), **Ink On Light** (`{colors.ink-on-light}` - #111111, 17.4:1), **Body On Light** (`{colors.body-on-light}` - #4D4D4D, 7.8:1), **Muted On Light** (`{colors.muted-on-light}` - #6E7375, 4.4:1), **Hairline On Light** (`{colors.hairline-on-light}` - #B4C7CC).
- Primary button on light: Air Black fill with Frost text.
- Gradients on light: swap the stops (Frost and Pastel Blue tones instead of Deep Tide and Air Black), keep the angles.

### Semantic (functional only)
Derived, since neither palette has signal colors. Status only, never decoration.
- **Info** (`{colors.semantic-info}` - #8EB0C9), **Success** (`{colors.semantic-success}` - #6FBF9F, 8.7:1 on canvas), **Warning** (`{colors.semantic-warning}` - #D9A441, 8.4:1), **Danger** (`{colors.semantic-danger}` - #E5737D, 6.4:1 on canvas, only 3.8:1 on Black Olive: use danger as text on canvas, or as an icon or border on cards).

## Gradients

Gradients are the signature of the system, and the place where the two palettes meet.

| Token | Definition | Use |
|---|---|---|
| `{gradients.canvas}` | 180deg, Deep Tide 0% to Air Black 60% | Page and band backgrounds. Blue-lit top fading into graphite. |
| `{gradients.glow}` | Radial ellipse at top center, Steel 45% alpha to transparent | Overlay on hero areas, empty states, login, review queue backdrop. |
| `{gradients.card}` | 160deg, Black Olive to #1A1A1A | Cards, panels, modals. The graphite surface. |
| `{gradients.dusk}` | 135deg, Deep Tide to Black Olive | Featured panels: analysis panel, login card, highlighted stats. Blue melting into graphite. |
| `{gradients.accent}` | 135deg, Pastel Blue to Frost | Optional primary CTA fill, progress bars, selected highlights. |
| `{gradients.steel}` | 135deg, Deep Tide to #2F5574 | Active nav item, active filter chip, selected state. |
| `{gradients.scrim}` | 180deg, transparent to Air Black 85% alpha | Over the bottom of media for captions, player controls, hover info. |
| `{gradients.hairline}` | 90deg, transparent to Steel to transparent | Accent divider between major sections. |

### Gradient rules
- Gradients sit **behind or around** content, never on top of media, except the scrim that protects text.
- **Text contrast is checked at the worst stop.** Ink on the steel end (#2F5574) is 5.6:1; Ink on Black Olive 8.1:1. Body (Gray) text on `{gradients.steel}` is not allowed (4.0:1). On `{gradients.dusk}` and `{gradients.card}` use Ink, Body or Body Accent only.
- At most **two prominent gradients per viewport**, plus scrims. Normal combination: the page `canvas` gradient plus one `dusk` or `accent`.
- Angles are consistent: 180deg for page and scrims, 160deg for cards, 135deg for accents and states.
- No hue shifts: no purple, teal, rainbow. Only blue and graphite stops.
- Motion: an optional slow shift of `{gradients.glow}` (8 to 12 seconds) may indicate the "analisando" state. Respect reduced motion.

## Typography

### Font Family
**Inter** is the single sans family across every text role. Fallback: `-apple-system, system-ui, sans-serif`.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-mega}` | 80px | 500 | 1.05 | -1.6px | Login and empty-state hero |
| `{typography.display-xl}` | 56px | 500 | 1.1 | -1.12px | Page hero |
| `{typography.display-lg}` | 36px | 500 | 1.2 | -0.36px | Page titles |
| `{typography.display-md}` | 26px | 500 | 1.5 | 0.195px | Section heads |
| `{typography.title-md}` | 18px | 700 | 1.2 | 0 | Card and panel titles |
| `{typography.title-sm}` | 16px | 500 | 1.4 | 0.08px | List labels |
| `{typography.body-md}` | 14px | 400 | 1.5 | 0 | Default body |
| `{typography.body-sm}` | 13px | 400 | 1.5 | 0 | Secondary text |
| `{typography.caption}` | 12px | 400 | 1.4 | 0 | Media captions, metadata |
| `{typography.caption-uppercase}` | 11px | 600 | 1.4 | 1.1px | Section labels, chips, badges |
| `{typography.button}` | 14px | 700 | 1.0 | 1.4px (uppercase) | CTA labels |
| `{typography.nav-link}` | 13px | 600 | 1.4 | 0.65px (uppercase) | Sidebar and top bar items |
| `{typography.number-display}` | 80px | 700 | 1.0 | -1.6px | Big stats (counts, queue size) |

### Principles
- Display weight stays at 500. The media carries the visual weight.
- CTA and nav labels are uppercase with tracking. Negative tracking on display sizes only.
- Interface copy is pt-BR; analysis text on cards is English. Same type tokens for both.

## Layout

### Spacing System
- **Base unit:** 4px. **Tokens:** `{spacing.xxxs}` 4px, `{spacing.xxs}` 8px, `{spacing.xs}` 16px, `{spacing.sm}` 24px, `{spacing.md}` 32px, `{spacing.lg}` 48px, `{spacing.xl}` 64px, `{spacing.xxl}` 96px, `{spacing.super}` 128px.
- Always use the named ladder, never ad-hoc pixel values.

### Grid & Container
- App shell: fixed sidebar (240px) plus top bar (64px), fluid content.
- Library: masonry grid, 2 columns mobile, 3 tablet, 4 to 6 desktop, gap `{spacing.xs}`.
- Detail and review screens: media left (fluid), panel right (360 to 440px).
- Reading panels max width 1280px.

### Whitespace Philosophy
Generous around the media, tight inside data panels.

## Elevation & Depth

Depth is **brightness step plus gradient**, not shadow.

| Level | Treatment | Use |
|---|---|---|
| Flat | `{colors.canvas}` with the ambient glows (`--gradient-ambient`, fixed) | Page |
| Glass | `glass`: translucent graphite, 24px blur, 1px `--glass-border`, inner top highlight | Sidebar, top bar, cards, side panels, lists |
| Glass strong | `glass-strong`: more opaque, 32px blur, overlay shadow | Popovers, menus, selects, dialogs, tray |
| Glass panel | `glass-panel`: near-opaque graphite, same border and shadow, **no blur** | Sheets (Filtros, mobile menu). Large animated panels must not use backdrop-filter: blurring them every frame over the feed makes them lag. Modal and sheet scrims are plain dimming, no blur, for the same reason. |
| Featured | `{gradients.dusk}` | Analysis panel, login card |
| Lit | `{gradients.glow}` overlay | Hero, empty states, backdrop of the active item |
| Selected | `{gradients.steel}` | Active nav, active chip |
| Hairline | 1px `{colors.hairline-strong}` on cards, `{colors.hairline}` on canvas | Outlines, dividers |
| Media | Image or video at full brightness | The brightest element on the screen |

One optional soft shadow on modals and popovers only: `0 8px 24px rgba(0,0,0,0.45)`.

## Shapes

Corners live on an 8-16px ladder. Tailwind classes map to these tokens in `app/globals.css`.

| Token | Value | Use |
|---|---|---|
| `rounded-tag` | 5px | Tiny controls only (checkbox, kbd) |
| `rounded-sm` | 8px | Filter chips, swatches, labels over media |
| `rounded-input` / `rounded-md` | 10px | Buttons, inputs, search field, toasts |
| `rounded-lg` / `rounded-popover` | 12px | Popovers, menus, thumbnails |
| `rounded-xl` | 14px | Media cards, nav items |
| `rounded-2xl` / `rounded-modal` | 16px | Panels, sidebar, top bar, modals |
| `rounded-full` | 9999px | Badges and avatars only |

## Components

### Navigation
**`sidebar`** is a floating glass panel modelled on the "Quantix" reference, and the only chrome: there is no top bar (phones get a floating menu button that opens the same content in a drawer). Expanded (272px): brand tile with "Awen / Banco de referências" and a bordered chevron toggle (also `[`); a "Bem-vindo de volta, {nome}" greeting with the last sign-in date; the search field and the Frost "Adicionar referência" button, inset like the rows; labelled sections **Visão geral** (Biblioteca, Revisão, Falharam when there are failures), **Explorar** (Vídeos, Imagens, Favoritas, Aleatória), **Organizar** (Artistas, Projetos); then the analysis-queue card and the account row (avatar, name, email) that opens Configurações. Rows are 44px with 20px outline icons; the active row is a glass pill brightening to the right (`bg-gradient-nav-active`) with a short bar at its end; counts sit in small bordered boxes. Collapsed (68px): icons only, a tooltip on every item, section labels become short hairlines, attention counts become dot badges. The state persists in the `awen_sidebar` cookie.

### Buttons
- **`button-primary`**: Frost fill, Air Black text, 44px high, 10px corners. The only filled action color.
- **`button-primary-gradient`**: filled with `{gradients.accent}`. The single most important action on a screen (Aprovar, Adicionar).
- **`button-outline`**: transparent, 1px Frost border, Ink text.
- **`button-tertiary-text`**: inline uppercase link.
- **`button-danger-outline`**: Rejeitar and Apagar, danger text and border, on canvas only.

### Media
- **`media-card`** (library feed, Pinterest-style): masonry where each pin goes into the shortest column, ~220px columns with 16px gutters (8px on phones), 16px corners, title and shot/mood below the image. On hover the pin dims and shows "Salvar" (adds to the active project), the palette and the rating. Infinite scroll. On hover a `{gradients.scrim}` reveals title, duration and select checkbox.
- **`media-card-overlay`** and **`player-controls`**: always over a scrim.

### Panels
**`surface-card`**, lists and side panels use `glass` with 16px corners; **`modal`** uses `glass-strong`. Media and side panel sit side by side with a 12px gap, each in its own rounded panel. **`analysis-panel`** is a glass panel: it holds read-only technical data, the palette row, editable AI fields (dropdowns from the fixed lists), tag chips and notes.

### Data
- **`palette-swatch`**: row of 5 to 6 swatches with hex and percentage, 48px high.
- **`stat-cell`**: big numbers with an uppercase label.
- **`list-row`**: hairline-divided rows for people, projects, settings.
- **`divider-accent`**: the gradient hairline between major sections.

### Forms & Tags
- **`text-input`** and **`search-field`**: 48px and 44px high, 10px corners, 1px strong hairline, Frost focus ring.
- **`filter-chip`** and **`filter-chip-active`** (steel gradient): uppercase caption, 8px corners, removable when active.
- **`badge-pill`**: the only pill shape; counts, confidence labels, status.

### Review queue
**`review-action-bar`**: fixed bottom bar with Rejeitar (danger outline), Editar (outline), Aprovar (`button-primary-gradient`), keyboard shortcuts as small captions. **`progress-bar`** (2px, accent gradient) shows queue position.

### Feedback
**`toast`**: Black Olive, Ink text, 10px corners. Status as a small leading mark in the semantic color, never a full-color background.

## Do's and Don'ts

### Do
- Keep every color inside the two palettes, the derived light variant and the four semantic colors.
- Graphite for structure, blue for atmosphere and action.
- Use Frost for the primary action, one per screen region.
- Put a scrim under any text on media.
- Keep media at full brightness, the brightest thing on screen.
- Use the named 8px spacing ladder. Keep display weight at 500.

### Don't
- Don't add a saturated accent hue, or purple, teal or rainbow gradients.
- Don't use Muted (#4D4D4D) or Steel (#4B708D) for readable text.
- Don't put Gray body text on Dark Liver or on the steel gradient.
- Don't put more than two prominent gradients in one viewport.
- Don't tint, filter or overlay images and video, except the text scrim.
- Don't use pill buttons, or corners outside the 8-16px ladder on layout surfaces.
- Don't put glass on glass without a reason; nested surfaces use hairlines, not another blur.
- Don't add drop shadow tiers beyond `glass` and `glass-strong`.
- Don't use pure black. The floor is Air Black (#111111).

## Responsive Behavior

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 640px | Sidebar becomes bottom bar or drawer; library 2-up; detail and review stack; display-mega 80 to 32px. |
| Tablet | 640-1024px | Sidebar collapses to icons; library 3-up; detail panel below media. |
| Desktop | 1024-1280px | Full sidebar; library 4-up; detail side by side. |
| Wide | > 1280px | Library 5 to 6-up; reading panels cap at 1280px. |

- Touch targets: primary CTA 48px; nav items 44px minimum, 48px tap area.
- Filter panel becomes a full-screen sheet on mobile. Gradients stay, glow radius shrinks. Review action bar stays fixed at the bottom.

## Iteration Guide

1. Work on one component at a time.
2. CTAs and cards default to `{rounded.none}`. Pill is for badges only.
3. Use `{token.refs}` everywhere. Never inline hex or gradient strings in components.
4. Gradients: pick the token that matches the job (canvas, glow, card, dusk, accent, steel, scrim, hairline). Do not invent new ones.
5. Check text contrast at the worst gradient stop.
6. Graphite is structure, blue is atmosphere and action. Frost stays the single action color.
7. Use the explicit 8px named spacing ladder.

## Known Gaps

- The blue palette image had inconsistent hex labels, so its five tones were sampled from pixels: #091523 (Abyss, now only used as an implied darkest blue, not as canvas), #1E3A52, #4B708D, #8EB0C9, #CADCEA. The graphite palette labels were clean and used as given.
- Neither palette has signal colors: the four semantic colors and the light variant are derived.
- Derived stops: #1A1A1A (card), #2F5574 (steel), #E3EDF5 (primary hover).
- Hover states for secondary components, animation timings and form validation beyond focus are not specified.
- Inter is open source; swap the family token if another font is chosen.
