# SVRN Publishing — Implementation TODO

## 1. Fix asset modal nesting (original task)
- [ ] `AssetModal.jsx`: wrap `.asset-grid` in `.asset-scroll` container
- [ ] `styles.css`: add `.asset-scroll` styles, fix `.asset-item` overlap

## 2. Rebrand to "SVRN Publishing" (SVRN = Sovereign)
- [ ] `index.html` title
- [ ] `constants.js` APP_NAME
- [ ] `TopNav.jsx` logo
- [ ] `exportSystem.js` overlay text + filenames
- [ ] `manifest.json`, `sw.js`
- [ ] `CreditPurchase.jsx`, `Modal.jsx`
- [ ] `SovereignTokenManager.jsx` platform id
- [ ] `shaderBridge.js` comment
- [ ] `tutorialData.js` footer

## 3. Additional art styles (graffiti, sketch, pen & ink, watercolour)
- [ ] `VPContext.jsx`: add 4 content themes
- [ ] `PropertyPanel.jsx`: add matching page textures
- [ ] Add graffiti/ink/watercolour glyph & splat assets

## 4. Poster effects
- [ ] `PropertyPanel.jsx`: add screen VFX options
- [ ] `VfxSystem.jsx`: implement new VFX
- [ ] `PropertyPanel.jsx`: add poster CSS filter presets for elements
- [ ] `ElementContent.jsx` / `Reader.jsx`: render filter presets if needed

