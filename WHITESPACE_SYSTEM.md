# CrediSafe Whitespace System

This version applies a focus-first spacing system inspired by premium product storytelling.

## Principles

- One dominant message per viewport.
- Generous vertical rhythm between chapters.
- Narrow text measures for easier reading.
- Quiet surfaces with fewer borders and shadows.
- Data is grouped into clear, low-density clusters.
- Video remains the visual hero; UI supports it rather than competing with it.
- Mobile removes unnecessary glass panels and preserves breathing room.

## Core tokens

- Page gutter: `clamp(24px, 4vw, 72px)`
- Section spacing: `clamp(156px, 16vw, 236px)`
- Copy measure: `34rem`
- Wide copy measure: `46rem`

The implementation lives in the final **Apple-inspired whitespace system** section of `app/globals.css`.
