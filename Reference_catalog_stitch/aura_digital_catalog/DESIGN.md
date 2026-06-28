---
name: Aura Digital Catalog
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434656'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737688'
  outline-variant: '#c3c5d9'
  surface-tint: '#004ced'
  primary: '#003ec7'
  on-primary: '#ffffff'
  primary-container: '#0052ff'
  on-primary-container: '#dfe3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#3f4f65'
  on-tertiary: '#ffffff'
  tertiary-container: '#57677e'
  on-tertiary-container: '#d6e6ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#0038b6'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  container-padding: 20px
  gutter: 16px
---

## Brand & Style

This design system is engineered for a premium, mobile-first digital catalog experience. The brand personality is sophisticated, tech-forward, and intentionally restrained, allowing high-quality product imagery to remain the focal point. 

The aesthetic blends **Modern Minimalism** with **Glassmorphism**. It utilizes expansive white space, a disciplined neutral palette, and subtle translucent layers to create a sense of depth and atmospheric luxury. The emotional response should be one of calm confidence—an "in-trend" interface that feels expensive yet highly functional.

## Colors

The palette is built on a foundation of "Slate" neutrals to provide a professional, architectural feel. 

- **Primary (Electric Blue):** Used exclusively for primary calls-to-action, active states, and critical highlights. It provides a high-energy contrast against the muted background.
- **Secondary (Deep Slate):** Used for primary headings and icons to ensure high legibility and a grounded feel.
- **Neutral/Surface:** A range of soft grays (Slate 50 to 400) defines the UI structure. 
- **Glass Effect:** Surfaces use a semi-transparent white with a high backdrop-blur (20px-30px) to simulate premium frosted glass, especially for navigation bars and overlays.

## Typography

The typography utilizes **Inter** for its systematic, clean, and highly legible characteristics. 

- **Hierarchy:** We use tight tracking (letter-spacing) on larger headlines to create a "compact" premium look. 
- **Contrast:** Utilize `label-sm` in uppercase for category tags or metadata to differentiate from standard body text.
- **Mobile Scale:** On mobile devices, the `display` style is reserved for hero sections only, while `headline-md` serves as the primary view title.

## Layout & Spacing

The design system follows a strict **4pt grid system**. 

- **Mobile Grid:** A fluid 2-column or 1-column layout. Standard mobile views use a `container-padding` of 20px to provide more "breathing room" than standard apps.
- **Rhythm:** Use `xl` (32px) spacing between major sections and `md` (16px) for internal component padding.
- **Negative Space:** High-quality white space is a functional element here; do not crowd content. Ensure product images have at least 16px of clearance from any text.

## Elevation & Depth

Depth is communicated through **Soft Ambient Shadows** and **Backdrop Blurs**.

- **Level 1 (Default):** Flat background or subtle 1px stroke (#E2E8F0).
- **Level 2 (Cards):** Low-opacity shadow: `0px 4px 20px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Modals/Floating):** High-diffused shadow: `0px 20px 40px rgba(15, 23, 42, 0.12)`.
- **Glassmorphism:** Navigation bars and bottom sheets must use `backdrop-filter: blur(20px)` with a semi-transparent background (`surface_glass_hex`) and a 1px white top-border to simulate a glass edge.

## Shapes

The shape language is generous and friendly. 

- **Standard Elements:** Buttons and input fields use a **16px** (`rounded-lg`) corner radius.
- **Containers:** Product cards and main surface containers use a **24px** (`rounded-xl`) corner radius to emphasize the premium, modern feel.
- **Interactive States:** Use subtle scale-down transforms (98%) on press to provide tactile feedback without traditional skeuomorphism.

## Components

- **Elegant Cards:** Product cards should feature an aspect ratio of 4:5 for imagery. Text is left-aligned with a clear price highlight using `label-md` in the primary color.
- **Primary Buttons:** High-contrast Electric Blue background with white text. Height is fixed at 56px for mobile ergonomics, with a 16px radius.
- **Refined Modals:** Bottom-aligned "Sheet" modals. They must include a subtle grab-handle at the top and utilize the glassmorphism backdrop blur on the underlying content.
- **Clean Navigation:** A bottom navigation bar with minimal line-art icons. The active state is indicated by a primary-colored dot below the icon, rather than a fill change.
- **Input Fields:** Minimalist style with a light gray fill (#F1F5F9) and no border, becoming a 1px primary border on focus.
- **Chips/Filters:** Pill-shaped with a 1px slate-200 border. Active chips transition to a solid Slate-900 background with white text.