# Design System: iPhoneRepasse Design System Remix

You are building a web application using the following design system. Apply these tokens consistently across **every** component, page, and layout you create. Never hardcode colors, spacing, font sizes, or shadow values — always reference the CSS custom properties defined below.

## Sources
- Reference visual DNA: SeroClub (https://github.com/italomcangussu/seroclub)
- Brand adaptation: iPhoneRepasse blue/orange identity
- Theme support: Light and Dark with AA contrast goals

## Setup

Add this to your root HTML or global CSS file:

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

```css
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-primary-strong: #1d4ed8;
  --color-primary-soft: #60a5fa;
  --color-accent: #f97316;
  --color-accent-strong: #c2410c;
  --color-accent-soft: #fdba74;
  --color-text: #0f172a;
  --color-text-secondary: #334155;
  --color-text-muted: #64748b;
  --color-bg: #f8fafc;
  --color-bg-2: #f1f5f9;
  --color-surface: #ffffff;
  --color-surface-2: #e2e8f0;
  --color-border: rgba(15,23,42,0.12);
  --color-border-strong: rgba(15,23,42,0.2);
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-info: #0ea5e9;
  --color-dark-text: #f8fafc;
  --color-dark-text-secondary: #cbd5e1;
  --color-dark-text-muted: #94a3b8;
  --color-dark-bg: #020617;
  --color-dark-bg-2: #0b1220;
  --color-dark-surface: #111827;
  --color-dark-surface-2: #1f2937;
  --color-dark-border: rgba(148,163,184,0.25);
  --color-dark-border-strong: rgba(148,163,184,0.4);
  --color-dark-primary: #60a5fa;
  --color-dark-primary-strong: #3b82f6;
  --color-dark-accent: #fb923c;
  --color-dark-accent-strong: #f97316;
  --color-dark-success: #4ade80;
  --color-dark-warning: #f59e0b;
  --color-dark-error: #f87171;
  --color-dark-info: #38bdf8;

  /* Typography - Families */
  --font-heading: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-body: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'Space Mono', 'JetBrains Mono', monospace;

  /* Typography - Scale */
  --font-size-2xs: 0.625rem;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2.125rem;
  --font-size-3xl: 2.75rem;
  --font-size-4xl: 3.75rem;

  /* Typography - Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;

  /* Typography - Line Heights */
  --line-height-tight: 1.1;
  --line-height-snug: 1.3;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.7;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Border Radius */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(15,23,42,0.08);
  --shadow-md: 0 8px 20px rgba(15,23,42,0.12);
  --shadow-lg: 0 20px 45px rgba(15,23,42,0.18);
  --shadow-xl: 0 30px 70px rgba(2,6,23,0.24);
  --shadow-glow-primary: 0 0 24px rgba(37,99,235,0.30), 0 0 60px rgba(37,99,235,0.16);
  --shadow-glow-accent: 0 0 24px rgba(249,115,22,0.28), 0 0 60px rgba(249,115,22,0.14);
  --shadow-inner: inset 0 1px 0 rgba(255,255,255,0.15);

  /* Transitions */
  --transition-fast: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-default: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: all 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-reveal: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
```

```css
[data-theme="dark"] {
  --color-text: var(--color-dark-text);
  --color-text-secondary: var(--color-dark-text-secondary);
  --color-text-muted: var(--color-dark-text-muted);
  --color-bg: var(--color-dark-bg);
  --color-bg-2: var(--color-dark-bg-2);
  --color-surface: var(--color-dark-surface);
  --color-surface-2: var(--color-dark-surface-2);
  --color-border: var(--color-dark-border);
  --color-border-strong: var(--color-dark-border-strong);
  --color-primary: var(--color-dark-primary);
  --color-primary-strong: var(--color-dark-primary-strong);
  --color-accent: var(--color-dark-accent);
  --color-accent-strong: var(--color-dark-accent-strong);
  --color-success: var(--color-dark-success);
  --color-warning: var(--color-dark-warning);
  --color-error: var(--color-dark-error);
  --color-info: var(--color-dark-info);
}
```

## Animations

Include these keyframe definitions in your global CSS:

```css
@keyframes sm-fade-up {
  from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); }
}

@keyframes sm-fade-in {
  from { opacity: 0; } to { opacity: 1; }
}

@keyframes sm-glow-pulse {
  0%, 100% { box-shadow: var(--shadow-glow-primary); } 50% { box-shadow: 0 0 48px rgba(37,99,235,0.5), 0 0 96px rgba(37,99,235,0.25); }
}

@keyframes sm-float {
  0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); }
}

@keyframes sm-gradient-drift {
  0% { transform: translate(0%, 0%) scale(1); } 33% { transform: translate(4%, -6%) scale(1.08); } 66% { transform: translate(-5%, 4%) scale(0.95); } 100% { transform: translate(0%, 0%) scale(1); }
}

@keyframes sm-shimmer {
  0% { background-position: -200% center; } 100% { background-position: 200% center; }
}

@keyframes sm-orb-drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1); } 25% { transform: translate(6%, -8%) scale(1.1); } 50% { transform: translate(-4%, 6%) scale(0.92); } 75% { transform: translate(8%, 3%) scale(1.05); }
}

@keyframes sm-orb-drift-2 {
  0%, 100% { transform: translate(0, 0) scale(1); } 30% { transform: translate(-7%, 5%) scale(1.12); } 60% { transform: translate(5%, -7%) scale(0.9); } 80% { transform: translate(-3%, -4%) scale(1.07); }
}
```


## Usage Guidelines

### Colors
- Primary actions (buttons, links, active states): `var(--color-primary)`
- Secondary/supporting elements: `var(--color-secondary)`
- Accent highlights: `var(--color-accent)` (if defined)
- For small/body text over light surfaces, prefer `var(--color-accent-strong)` to keep AA contrast.
- Backgrounds: `var(--color-bg)` for main, `var(--color-bg-secondary)` for cards/sections
- Text: `var(--color-text)` for body, `var(--color-text-secondary)` for muted
- Semantic: `var(--color-success)`, `var(--color-warning)`, `var(--color-error)`, `var(--color-info)`
- Borders: `var(--color-border)`

### Typography
- Headings: Use `var(--font-heading)` family with appropriate `var(--font-size-*)` tokens
- Body text: Use `var(--font-body)` family at `var(--font-size-base)`
- Small/caption text: `var(--font-size-sm)` or `var(--font-size-xs)`
- Code/mono: `var(--font-mono)` if defined

### Spacing
- Use the spacing scale for all margins, paddings, and gaps: `var(--space-1)` through `var(--space-16)`
- Component internal padding: typically `var(--space-4)` to `var(--space-6)`
- Section spacing: `var(--space-8)` to `var(--space-16)`
- Inline element gaps: `var(--space-2)` to `var(--space-3)`

### Borders & Radius
- Buttons and inputs: `var(--radius-md)`
- Cards and containers: `var(--radius-lg)`
- Badges and pills: `var(--radius-full)` or `9999px`
- Subtle rounding: `var(--radius-sm)`

### Shadows
- Flat/default: `var(--shadow-sm)`
- Cards and dropdowns: `var(--shadow-md)`
- Modals and elevated elements: `var(--shadow-lg)`
- Focused/emphasized: `var(--shadow-xl)`

### Transitions & Animations
- All interactive elements should use `transition: var(--transition-default)` for hover/focus states
- Page transitions and reveals: Use the defined @keyframes animations
- Keep motion subtle and purposeful — prefer 150-300ms durations

### Signature Gradients
Use these gradients for hero sections, CTAs, or decorative backgrounds:
- `linear-gradient(120deg, #1d4ed8 0%, #2563eb 45%, #f97316 100%)`
- `radial-gradient(ellipse 80% 60% at 60% 40%, rgba(37,99,235,0.16) 0%, transparent 62%)`
- `radial-gradient(ellipse 45% 45% at 12% 82%, rgba(249,115,22,0.12) 0%, transparent 55%)`
- `linear-gradient(90deg, #0f172a 0%, #1d4ed8 40%, #f97316 72%, #f8fafc 100%)`


## Component Patterns

When creating new components, follow these patterns:

### Buttons
```css
.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold, 600);
  font-size: var(--font-size-sm);
  transition: var(--transition-default);
  cursor: pointer;
}
.btn-primary {
  background: var(--color-primary);
  color: white;
}
```

### Cards
```css
.card {
  background: var(--color-bg-secondary, var(--bg-secondary));
  border: 1px solid var(--color-border, var(--border));
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}
```

### Inputs
```css
.input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border, var(--border));
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: var(--transition-default);
}
.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
}
```

## Rules

1. **Never hardcode values.** Always use `var(--token-name)`. This ensures consistency and makes theme changes trivial.
2. **Dark mode**: If implementing dark mode, override the `:root` variables inside `[data-theme="dark"]` or `@media (prefers-color-scheme: dark)`.
3. **New tokens**: If you need a value not in the system (e.g., a new color shade), derive it from existing tokens using `color-mix()` or `calc()` rather than introducing arbitrary values.
4. **Accessibility**: Ensure all text/background color combinations meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text).
5. **Responsive**: The spacing and typography scales are designed to work across screen sizes. Use `clamp()` for fluid typography if needed.
