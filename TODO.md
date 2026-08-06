# Void Press — 3D Glow Objects & Offline Upgrade

## Vendor mushu-flow for offline & advanced features
- [x] Create `src/lib/mushu/` vendored copy
- [x] Copy rich local `mushu` library (core, glsl, gpu) into project
- [x] Rewire imports to vendored copy (fully offline, no CDN)

## Rewrite 3D objects with real glow shaders
- [x] Rewrite `Object3D.jsx` using `shader3d()` custom GLSL (fresnel rim glow, additive halo, transparent, double-sided, time pulse)
- [x] Use `crystal` geometry from vendored mushu
- [x] Verify editor + reader render the glowing object

## Wire into asset library
- [x] Ensure `objects` category + `addAsset` place shader-based 3D objects
- [x] PropertyPanel model/color controls already added

## Verify
- [x] `npm run build` passes
- [x] App runs offline (vendored mushu, export uses MINI_MUSHU)
</content>
