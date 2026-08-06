# Zine Crafting System — Symbol Bank & Effects Upgrade

## Scope (confirmed)
Focus this pass on the **symbol bank + effects** to make the zine tool feel fantastic, fluid, and revolutionary.

## Steps
- [x] 1. Expand symbol bank in `VPContext.jsx`:
  - Add ink/blood splat PNGs (from `/assets/devils-atlas/`) as drop-in image symbols (4 blood + 9 ink).
  - Add ~60 new unicode/emoji symbols (revolutionary, occult, publishing, game, nature, celestial).
  - Vibrant tinted previews in the Asset Library.
  - Wire `addAsset` to create image elements for splats and text elements for glyphs.
- [x] 2. Expand screen VFX in `PropertyPanel.jsx` + `VfxSystem.jsx`:
  - Add glitch, scanline, static, fade-to-black, zoom, blood-overflow.
- [x] 3. Expand element animations in `PropertyPanel.jsx` + `Reader.jsx`:
  - Add glitch, flicker, breathe, bounce, wobble, blink, drift, fly-in.
- [x] 4. Add CSS `@keyframes` for all new VFX overlays and reader element animations in `styles.css`.
- [x] 5. Verify build / lint.

## Bug Fixes (from feedback)
- [x] Symbols now freely draggable: glyph symbols render as non-editable `symbol:true` divs (ElementContent.jsx), CSS `.el-symbol` allows move cursor, drag handler no longer blocked.
- [x] Delete/Backspace no longer deletes elements while editing inputs/selects in the right-hand properties panel (Editor.jsx guards INPUT/TEXTAREA/SELECT + contentEditable).
- [x] Layout no longer crammed: asset grid widened to `minmax(130px,1fr)` with bigger gaps, symbols grouped under category divider headers (Ink & Blood, Revolution, Occult, Celestial, Publishing, Nature), and repeated drops stagger placement instead of stacking.
