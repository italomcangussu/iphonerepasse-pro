# Tablet Temporal Input Layout Design

## Problem

On iPad Safari, native temporal inputs can retain an intrinsic width larger than
their CSS grid track. The date field then paints over the adjacent email field.
The same primitive is used by 22 temporal inputs, including the Dashboard date
filters. The Dashboard also switches to a three-column layout at the same
viewport breakpoint where the ERP sidebar expands, leaving tablet content too
narrow.

## Design

- Keep the existing Swiss utility direction: neutral surfaces, sans typography,
  blue accent, compact hierarchy, and hairline separation.
- Fix temporal sizing once in `.ios-input`, scoped to iOS WebKit with
  `@supports (-webkit-touch-callout: none)`.
- Cover `date`, `datetime-local`, `time`, `month`, and `week` controls with
  `inline-size: 100%`, `max-inline-size: 100%`, `min-inline-size: 0`, and
  `-webkit-appearance: none`.
- Constrain `::-webkit-date-and-time-value` so the native value cannot restore
  an intrinsic minimum width.
- Keep Dashboard metric and chart layouts at two/one columns through tablet;
  enable three columns at `xl` (1280px) only.
- Add regression contracts and browser smoke coverage for 768, 820, 834, 1024,
  and 1194px tablet viewports.

## Verification

- Vitest contract test must fail before the CSS and breakpoint changes.
- TypeScript typecheck and affected component tests must pass.
- WebKit geometry audit must show temporal fields contained by their grid tracks.
- Responsive smoke coverage must include the Dashboard and reject horizontal
  document or temporal-control overflow.
