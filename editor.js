// ═══════════════════════════════════════════
// VOID PRESS - Editor Engine
// ═══════════════════════════════════════════
VP.ed = {
    pages: [], pageIdx: 0, sel: null, zoom: 1, clipboard: null, idCtr: 0,
    gridOn: false, snapOn: true, history: [], historyIdx: -1, maxHist: 50,

    themes: {
        classic: { '--ed-black': '#1a1a1a', '--ed-crimson': '#5c0a0a', '--ed-white': '#fdfaf1', '--ed-purple': '#4b2c5e', '--ed-green': '#2ecc71', '--ed-gold': '#d4af37', '--ed-silver': '#bdc3c7', '--ed-gray': '#34495e', '--ed-font': "'EB Garamond',serif", '--ed-display': "'Playfair Display',serif", '--ed-accent': "'Crimson Text',serif", status: 'STABLE' },
        fantasy: { '--ed-black': '#0a0a0a', '--ed-crimson': '#8b0000', '--ed-white': '#f5f5dc', '--ed-purple': '#4b0082', '--ed-green': '#00ff41', '--ed-gold': '#ffd700', '--ed-silver': '#c0c0c0', '--ed-gray': '#2c2c2c', '--ed-font': "'Crimson Text',serif", '--ed-display': "'Cinzel',serif", '--ed-accent': "'MedievalSharp',cursive", status: 'LEGENDARY' },
        cyberpunk: { '--ed-black': '#050505', '--ed-crimson': '#ff003c', '--ed-white': '#f0f0f0', '--ed-purple': '#bc00ff', '--ed-green': '#00f3ff', '--ed-gold': '#fcee0a', '--ed-silver': '#333', '--ed-gray': '#121212', '--ed-font': "'Roboto Mono',monospace", '--ed-display': "'Orbitron',sans-serif", '--ed-accent': "'Bebas Neue',sans-serif", status: 'CONNECTED' },
        conspiracy: { '--ed-black': '#000', '--ed-crimson': '#4a0000', '--ed-white': '#e8e4d9', '--ed-purple': '#2a003a', '--ed-green': '#00ff00', '--ed-gold': '#c5b358', '--ed-silver': '#7f8c8d', '--ed-gray': '#1c1c1c', '--ed-font': "'Courier Prime',monospace", '--ed-display': "'Special Elite',cursive", '--ed-accent': "'Roboto Mono',monospace", status: 'CLASSIFIED' },
        worldbuilding: { '--ed-black': '#2c3e50', '--ed-crimson': '#e74c3c', '--ed-white': '#ecf0f1', '--ed-purple': '#8e44ad', '--ed-green': '#27ae60', '--ed-gold': '#f1c40f', '--ed-silver': '#95a5a6', '--ed-gray': '#34495e', '--ed-font': "'Assistant',sans-serif", '--ed-display': "'Montserrat',sans-serif", '--ed-accent': "'Crimson Text',serif", status: 'CHARTED' },
        comics: { '--ed-black': '#000', '--ed-crimson': '#ff0000', '--ed-white': '#fff', '--ed-purple': '#663399', '--ed-green': '#32cd32', '--ed-gold': '#ffd700', '--ed-silver': '#ccc', '--ed-gray': '#222', '--ed-font': "'Comic Neue',cursive", '--ed-display': "'Bangers',cursive", '--ed-accent': "'Bebas Neue',sans-serif", status: 'DYNAMIC' },
        arcane: { '--ed-black': '#0f041b', '--ed-crimson': '#6a040f', '--ed-white': '#f8f1ff', '--ed-purple': '#3c096c', '--ed-green': '#70e000', '--ed-gold': '#ff9e00', '--ed-silver': '#5a189a', '--ed-gray': '#240046', '--ed-font': "'Crimson Text',serif", '--ed-display': "'Cinzel Decorative',cursive", '--ed-accent': "'Cinzel',serif", status: 'MANIFESTED' }
    },

    init() {
        const c = document.getElementById('canvas');
        c.addEventListener('click', e => { if (e.target === c) this.deselectAll() });
        c.addEventListener('contextmenu', e => { e.preventDefault(); const m = document.getElementById('ctxMenu'); m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px'; m.classList.add('active') });
        document.getElementById('fileInput').addEventListener('change', e => this.handleImageUpload(e));
    },

    loadProject(proj) {
        this.pages = proj.pages || []; this.pageIdx = 0; this.sel = null; this.history = []; this.historyIdx = -1;
        if (!this.pages.length) this.pages.push({ id: Date.now(), elements: [], background: '#ffffff', texture: null });
        if (proj.theme) document.getElementById('themeSelect').value = proj.theme;
        this.render(); this.updateThumbs(); this.updateFooter();
    },

    pushHistory() {
        this.history = this.history.slice(0, this.historyIdx + 1);
        this.history.push(JSON.stringify(this.pages));
        if (this.history.length > this.maxHist) this.history.shift();
        this.historyIdx = this.history.length - 1;
        if (VP.currentProject) { VP.currentProject.pages = this.pages; VP.saveAll() }
    },
    undo() { if (this.historyIdx > 0) { this.historyIdx--; this.pages = JSON.parse(this.history[this.historyIdx]); this.sel = null; this.render(); this.updateThumbs(); VP.toast('Undo', 'info') } },
    redo() { if (this.historyIdx < this.history.length - 1) { this.historyIdx++; this.pages = JSON.parse(this.history[this.historyIdx]); this.sel = null; this.render(); this.updateThumbs(); VP.toast('Redo', 'info') } },

    // Pages
    curPage() { return this.pages[this.pageIdx] },
    addPage() {
        if (this.pages.length >= 32) { VP.toast('Max 32 pages', 'error'); return }
        this.pages.push({ id: Date.now(), elements: [], background: '#ffffff', texture: null });
        this.pageIdx = this.pages.length - 1; this.pushHistory(); this.render(); this.updateThumbs(); this.updateFooter();
    },
    deletePage() {
        if (this.pages.length <= 1) { VP.toast('Cannot delete last page', 'error'); return }
        if (!confirm('Delete page?')) return;
        this.pages.splice(this.pageIdx, 1); this.pageIdx = Math.min(this.pageIdx, this.pages.length - 1);
        this.pushHistory(); this.render(); this.updateThumbs(); this.updateFooter();
    },
    duplicatePage() {
        if (this.pages.length >= 32) { VP.toast('Max 32 pages', 'error'); return }
        const d = JSON.parse(JSON.stringify(this.curPage())); d.id = Date.now();
        this.pages.splice(this.pageIdx + 1, 0, d); this.pageIdx++;
        this.pushHistory(); this.render(); this.updateThumbs(); this.updateFooter();
    },
    goToPage(i) { this.pageIdx = i; this.deselectAll(); this.render(); this.updateThumbs(); this.updateFooter() },
    nextPage() { if (this.pageIdx < this.pages.length - 1) this.goToPage(this.pageIdx + 1) },
    prevPage() { if (this.pageIdx > 0) this.goToPage(this.pageIdx - 1) },
    updateFooter() {
        document.getElementById('pageNum').textContent = this.pageIdx + 1;
        document.getElementById('pageTotal').textContent = this.pages.length;
    },
    updateThumbs() {
        const c = document.getElementById('pageThumbs'); let h = '';
        this.pages.forEach((p, i) => { h += `<div class="page-thumb${i === this.pageIdx ? ' active' : ''}" onclick="VP.ed.goToPage(${i})" style="background:${p.background}"><span class="page-thumb-num">${i + 1}</span></div>` });
        c.innerHTML = h;
    },

    // Elements
    genId() { return 'el_' + (this.idCtr++) },
    addToPage(el) { this.curPage().elements.push(el); this.pushHistory(); this.render(); this.selectEl(el) },

    addText() {
        this.addToPage({ id: this.genId(), type: 'text', x: 80, y: 80, width: 220, height: 50, content: 'Enter text here...', fontSize: 18, fontFamily: 'Crimson Text', color: '#0a0a0a', align: 'left', bold: false, italic: false, rotation: 0, opacity: 1, zIndex: this.curPage().elements.length, shadow: '', blur: 0, borderWidth: 0, borderColor: '#000', borderRadius: 0 });
    },
    addImage() { document.getElementById('fileInput').click() },
    handleImageUpload(e) {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => { this.addToPage({ id: this.genId(), type: 'image', x: 80, y: 80, width: 200, height: 200, src: ev.target.result, rotation: 0, opacity: 1, zIndex: this.curPage().elements.length, filter: '', borderWidth: 0, borderColor: '#000', borderRadius: 0, objectFit: 'contain' }) };
        r.readAsDataURL(f); e.target.value = '';
    },

    addAsset(type, assetId) {
        const base = { id: this.genId(), x: 120, y: 120, rotation: 0, opacity: 1, zIndex: this.curPage().elements.length, shadow: '', blur: 0, borderWidth: 0, borderColor: '#000', borderRadius: 0 };
        let el = base;
        if (type === 'panels') {
            el = { ...base, type: 'panel', width: 220, height: 160, panelBorderWidth: 4, panelBorderColor: assetId === 'neon' ? '#00f3ff' : '#0a0a0a', panelBorderStyle: assetId === 'torn' ? 'dashed' : 'solid', panelRadius: assetId === 'rect-rounded' ? 12 : 0, fill: 'transparent', panelShadow: assetId === 'neon' ? '0 0 15px #bc00ff' : 'none' };
        } else if (type === 'shapes') {
            const shapes = { circle: { type: 'shape', shape: 'circle', width: 100, height: 100, fill: '#0a0a0a' }, square: { type: 'shape', shape: 'rect', width: 100, height: 100, fill: '#0a0a0a' }, triangle: { type: 'shape', shape: 'triangle', width: 100, height: 100, fill: '#0a0a0a' }, hexagon: { type: 'shape', shape: 'hexagon', width: 100, height: 100, fill: '#0a0a0a' }, star_shape: { type: 'text', content: '★', fontSize: 60, color: '#FFD700', width: 80, height: 80, fontFamily: 'sans-serif' }, diamond: { type: 'shape', shape: 'diamond', width: 80, height: 100, fill: '#0a0a0a' }, line_h: { type: 'shape', shape: 'line_h', width: 200, height: 4, fill: '#0a0a0a' }, arrow: { type: 'text', content: '➤', fontSize: 48, color: '#0a0a0a', width: 60, height: 60, fontFamily: 'sans-serif' } };
            el = { ...base, ...(shapes[assetId] || shapes.circle) };
        } else if (type === 'balloons') {
            const b = { dialog: { balloonType: 'dialog', width: 200, height: 80, content: 'Dialog text...', fontSize: 14 }, thought: { balloonType: 'thought', width: 160, height: 120, content: 'Thinking...', fontSize: 13 }, shout: { balloonType: 'shout', width: 170, height: 80, content: 'SHOUT!', fontSize: 18 }, caption: { balloonType: 'caption', width: 220, height: 50, content: 'Caption text', fontSize: 13 }, whisper: { balloonType: 'whisper', width: 180, height: 70, content: 'whisper...', fontSize: 12 }, narration: { balloonType: 'narration', width: 240, height: 60, content: 'Meanwhile...', fontSize: 14 } };
            el = { ...base, type: 'balloon', ...(b[assetId] || b.dialog) };
        } else if (type === 'sfx') {
            const t = { crash: 'CRASH!', boom: 'BOOM!', zap: 'ZAP!', whoosh: 'WHOOSH!', pow: 'POW!', splat: 'SPLAT!' };
            el = { ...base, type: 'text', content: t[assetId] || 'BAM!', fontSize: 52, fontFamily: 'Bangers', color: '#0a0a0a', width: 180, height: 70, strokeWidth: 2, strokeColor: '#fff' };
        } else if (type === 'symbols') {
            const s = { pentagram: '⛤', skull: '☠', star_symbol: '✦', eye: '👁', biohazard: '☣', radiation: '☢', compass: '🧭', rune: 'ᚱ', ankh: '☥', omega: 'Ω', infinity: '∞', trident: '🔱' };
            el = { ...base, type: 'text', content: s[assetId] || '✦', fontSize: 56, color: '#d4af37', width: 80, height: 80, fontFamily: 'sans-serif' };
        }
        this.addToPage(el);
    },

    getAssets(type) {
        const a = {
            panels: [{ id: 'rect', preview: '<div style="width:80%;height:80%;border:3px solid #ccc"></div>' }, { id: 'rect-rounded', preview: '<div style="width:80%;height:80%;border:3px solid #ccc;border-radius:10px"></div>' }, { id: 'dynamic', preview: '<div style="width:80%;height:80%;border:4px solid #ccc;transform:rotate(-3deg)"></div>' }, { id: 'torn', preview: '<div style="width:80%;height:80%;border:3px dashed #ccc"></div>' }, { id: 'neon', preview: '<div style="width:80%;height:80%;border:2px solid #00f3ff;box-shadow:0 0 8px #bc00ff"></div>' }],
            shapes: [{ id: 'circle', preview: '<div style="width:50px;height:50px;border-radius:50%;background:#888"></div>' }, { id: 'square', preview: '<div style="width:50px;height:50px;background:#888"></div>' }, { id: 'triangle', preview: '<div style="width:0;height:0;border-left:25px solid transparent;border-right:25px solid transparent;border-bottom:50px solid #888"></div>' }, { id: 'diamond', preview: '<div style="width:40px;height:40px;background:#888;transform:rotate(45deg)"></div>' }, { id: 'hexagon', preview: '<div style="font-size:40px;color:#888">⬡</div>' }, { id: 'star_shape', preview: '<div style="font-size:36px">★</div>' }, { id: 'line_h', preview: '<div style="width:60px;height:3px;background:#888"></div>' }, { id: 'arrow', preview: '<div style="font-size:30px">➤</div>' }],
            balloons: [{ id: 'dialog', preview: '<div style="background:#fff;border:2px solid #333;border-radius:16px;padding:6px;font-size:9px;color:#000">Hello!</div>' }, { id: 'thought', preview: '<div style="background:#fff;border:2px solid #333;border-radius:50%;padding:8px;font-size:9px;color:#000">💭</div>' }, { id: 'shout', preview: '<div style="background:#fff;border:3px solid #333;padding:6px;font-size:9px;color:#000;font-weight:bold">BANG!</div>' }, { id: 'caption', preview: '<div style="background:#000;color:#fff;padding:6px;font-size:9px">CAPTION</div>' }, { id: 'whisper', preview: '<div style="background:#f8f8f8;border:1px dashed #999;border-radius:16px;padding:6px;font-size:8px;color:#666">psst...</div>' }, { id: 'narration', preview: '<div style="background:#ffe;border:1px solid #cc9;padding:6px;font-size:8px;color:#333">Meanwhile...</div>' }],
            sfx: [{ id: 'crash', preview: '<div style="font-family:Bangers;font-size:20px;color:#e44">CRASH!</div>' }, { id: 'boom', preview: '<div style="font-family:Bangers;font-size:20px;color:#f80">BOOM!</div>' }, { id: 'zap', preview: '<div style="font-family:Bangers;font-size:20px;color:#ff0">ZAP!</div>' }, { id: 'pow', preview: '<div style="font-family:Bangers;font-size:20px;color:#f44">POW!</div>' }, { id: 'whoosh', preview: '<div style="font-family:Bangers;font-size:20px;color:#4af">WHOOSH</div>' }, { id: 'splat', preview: '<div style="font-family:Bangers;font-size:20px;color:#4a4">SPLAT!</div>' }],
            symbols: [{ id: 'pentagram', preview: '<div style="font-size:32px">⛤</div>' }, { id: 'skull', preview: '<div style="font-size:32px">☠</div>' }, { id: 'star_symbol', preview: '<div style="font-size:32px">✦</div>' }, { id: 'eye', preview: '<div style="font-size:32px">👁</div>' }, { id: 'biohazard', preview: '<div style="font-size:32px">☣</div>' }, { id: 'radiation', preview: '<div style="font-size:32px">☢</div>' }, { id: 'compass', preview: '<div style="font-size:32px">🧭</div>' }, { id: 'rune', preview: '<div style="font-size:32px">ᚱ</div>' }, { id: 'ankh', preview: '<div style="font-size:32px">☥</div>' }, { id: 'omega', preview: '<div style="font-size:32px">Ω</div>' }, { id: 'infinity', preview: '<div style="font-size:32px">∞</div>' }, { id: 'trident', preview: '<div style="font-size:32px">🔱</div>' }]
        };
        return a[type] || [];
    },

    // Templates
    insertTemplate(type) {
        const theme = VP.currentProject?.theme || 'classic';
        const t = this.themes[theme] || this.themes.classic;
        const page = this.curPage();
        page.elements = [];
        if (type === 'cover') {
            page.background = t['--ed-black'];
            page.elements = [
                { id: this.genId(), type: 'text', x: 40, y: 200, width: 448, height: 80, content: 'UNTITLED', fontSize: 64, fontFamily: t['--ed-display'].replace(/'/g, ''), color: t['--ed-gold'], align: 'center', bold: true, italic: false, rotation: 0, opacity: 1, zIndex: 1 },
                { id: this.genId(), type: 'text', x: 40, y: 300, width: 448, height: 40, content: 'A Void Press Publication', fontSize: 18, fontFamily: t['--ed-font'].replace(/'/g, ''), color: t['--ed-silver'], align: 'center', bold: false, italic: true, rotation: 0, opacity: .8, zIndex: 2 },
                { id: this.genId(), type: 'shape', shape: 'line_h', x: 140, y: 360, width: 248, height: 3, fill: t['--ed-gold'], rotation: 0, opacity: .6, zIndex: 3 }
            ];
        } else if (type === 'content') {
            page.background = '#ffffff';
            page.elements = [
                { id: this.genId(), type: 'text', x: 50, y: 40, width: 428, height: 40, content: 'Chapter Title', fontSize: 28, fontFamily: t['--ed-display'].replace(/'/g, ''), color: t['--ed-black'], align: 'left', bold: true, italic: false, rotation: 0, opacity: 1, zIndex: 1 },
                { id: this.genId(), type: 'shape', shape: 'line_h', x: 50, y: 85, width: 200, height: 2, fill: t['--ed-crimson'], rotation: 0, opacity: 1, zIndex: 2 },
                { id: this.genId(), type: 'text', x: 50, y: 110, width: 428, height: 600, content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.', fontSize: 14, fontFamily: t['--ed-font'].replace(/'/g, ''), color: '#222', align: 'left', bold: false, italic: false, rotation: 0, opacity: 1, zIndex: 3 }
            ];
        } else if (type === 'back') {
            page.background = t['--ed-gray'];
            page.elements = [
                { id: this.genId(), type: 'text', x: 40, y: 350, width: 448, height: 50, content: 'VOID PRESS', fontSize: 36, fontFamily: t['--ed-display'].replace(/'/g, ''), color: t['--ed-gold'], align: 'center', bold: true, italic: false, rotation: 0, opacity: 1, zIndex: 1 },
                { id: this.genId(), type: 'text', x: 40, y: 410, width: 448, height: 30, content: 'voidpress.pub', fontSize: 14, fontFamily: t['--ed-font'].replace(/'/g, ''), color: t['--ed-silver'], align: 'center', bold: false, italic: false, rotation: 0, opacity: .7, zIndex: 2 }
            ];
        }
        this.pushHistory(); this.render(); this.updateThumbs(); VP.toast('Template applied', 'success');
    },

    // Selection
    selectEl(el) { this.sel = el; this.render(); this.showProps(el); this.showEffects(el); this.updateLayers() },
    deselectAll() { this.sel = null; this.render(); this.showPageProps(); this.updateLayers(); document.getElementById('effectsContent').innerHTML = '<p style="font-size:.82em;color:var(--vp-text-dim);font-style:italic">Select an element for effects</p>' },
    deleteSelected() { if (this.sel) { const p = this.curPage(); const i = p.elements.findIndex(e => e.id === this.sel.id); if (i > -1) { p.elements.splice(i, 1); this.sel = null; this.pushHistory(); this.render(); this.updateLayers() } } },

    // Drag & Drop
    startDrag(e, el) {
        if (e.target.classList.contains('rh')) return;
        if (el.locked) return;
        if (e.target.isContentEditable) return;
        e.preventDefault();
        const canvas = document.getElementById('canvas');
        const rect = canvas.getBoundingClientRect();
        const offX = e.clientX / this.zoom - el.x - rect.left / this.zoom;
        const offY = e.clientY / this.zoom - el.y - rect.top / this.zoom;
        const onMove = ev => {
            let nx = ev.clientX / this.zoom - offX - rect.left / this.zoom;
            let ny = ev.clientY / this.zoom - offY - rect.top / this.zoom;
            if (this.snapOn) { nx = Math.round(nx / 10) * 10; ny = Math.round(ny / 10) * 10 }
            el.x = nx; el.y = ny; this.render();
        };
        const onUp = () => { this.pushHistory(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    },

    startResize(e, el, handle) {
        e.stopPropagation(); e.preventDefault();
        const sx = e.clientX, sy = e.clientY, sw = el.width, sh = el.height, sleft = el.x, stop = el.y;
        const onMove = ev => {
            const dx = (ev.clientX - sx) / this.zoom, dy = (ev.clientY - sy) / this.zoom;
            if (handle.includes('e')) el.width = Math.max(20, sw + dx);
            if (handle.includes('w')) { el.width = Math.max(20, sw - dx); el.x = sleft + dx }
            if (handle.includes('s')) el.height = Math.max(20, sh + dy);
            if (handle.includes('n')) { el.height = Math.max(20, sh - dy); el.y = stop + dy }
            this.render(); this.showProps(el);
        };
        const onUp = () => { this.pushHistory(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    },

    startRotate(e, el) {
        e.stopPropagation(); e.preventDefault();
        const canvas = document.getElementById('canvas');
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + (el.x + el.width / 2) * this.zoom;
        const cy = rect.top + (el.y + el.height / 2) * this.zoom;
        const onMove = ev => {
            const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90;
            el.rotation = Math.round(((angle % 360) + 360) % 360);
            this.render(); this.showProps(el);
        };
        const onUp = () => { this.pushHistory(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    },

    // Copy/Paste
    copyElement() { if (this.sel) { this.clipboard = JSON.parse(JSON.stringify(this.sel)); VP.toast('Copied', 'info') } },
    pasteElement() { if (this.clipboard) { const n = JSON.parse(JSON.stringify(this.clipboard)); n.id = this.genId(); n.x += 20; n.y += 20; this.addToPage(n) } },
    duplicateElement() { if (this.sel) { this.clipboard = JSON.parse(JSON.stringify(this.sel)); this.pasteElement() } },
    lockElement() { if (this.sel) { this.sel.locked = !this.sel.locked; this.pushHistory(); this.render(); VP.toast(this.sel.locked ? 'Locked' : 'Unlocked', 'info') } },

    // Layers
    moveLayer(dir) {
        if (!this.sel) return;
        const els = this.curPage().elements; const i = els.findIndex(e => e.id === this.sel.id);
        if (dir === 'up' && i < els.length - 1) { [els[i], els[i + 1]] = [els[i + 1], els[i]] }
        else if (dir === 'down' && i > 0) { [els[i], els[i - 1]] = [els[i - 1], els[i]] }
        else if (dir === 'top') { els.push(els.splice(i, 1)[0]) }
        else if (dir === 'bottom') { els.unshift(els.splice(i, 1)[0]) }
        els.forEach((e, idx) => e.zIndex = idx);
        this.pushHistory(); this.render(); this.updateLayers();
    },

    updateLayers() {
        const c = document.getElementById('layerList');
        const els = [...this.curPage().elements].reverse();
        let h = '';
        els.forEach(el => {
            const name = el.type === 'text' ? (el.content || '').substring(0, 15) : el.type;
            const active = this.sel && this.sel.id === el.id;
            h += `<div class="layer-item${active ? ' active' : ''}" onclick="VP.ed.selectElById('${el.id}')"><span class="layer-name">${el.locked ? '🔒 ' : ''}${name}</span><button class="layer-btn" onclick="event.stopPropagation();VP.ed.toggleVisById('${el.id}')">${el.hidden ? '👁‍🗨' : '👁'}</button></div>`;
        });
        c.innerHTML = h || '<p style="font-size:.78em;color:var(--vp-text-dim)">No elements</p>';
    },

    selectElById(id) { const el = this.curPage().elements.find(e => e.id === id); if (el) this.selectEl(el) },
    toggleVisById(id) { const el = this.curPage().elements.find(e => e.id === id); if (el) { el.hidden = !el.hidden; this.pushHistory(); this.render(); this.updateLayers() } },

    // Render
    render() {
        const canvas = document.getElementById('canvas');
        const page = this.curPage(); if (!page) return;
        canvas.innerHTML = '';
        canvas.style.background = page.background || '#fff';
        if (page.texture) { canvas.style.backgroundImage = `url('${page.texture}')`; canvas.style.backgroundSize = 'cover'; canvas.style.backgroundBlendMode = 'multiply' }
        else canvas.style.backgroundImage = 'none';
        const sorted = [...page.elements].filter(e => !e.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        sorted.forEach(el => canvas.appendChild(this.createEl(el)));
    },

    createEl(el) {
        const d = document.createElement('div');
        d.className = 'el' + (this.sel && this.sel.id === el.id ? ' selected' : '') + (el.locked ? ' locked' : '');
        d.style.cssText = `left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;transform:rotate(${el.rotation || 0}deg);z-index:${el.zIndex || 0};opacity:${el.opacity ?? 1};mix-blend-mode:${el.blendMode || 'normal'};`;
        if (el.shadow) d.style.boxShadow = el.shadow;
        if (el.blur) d.style.filter = `blur(${el.blur}px)`;
        if (el.borderWidth) d.style.border = `${el.borderWidth}px solid ${el.borderColor || '#000'}`;
        if (el.borderRadius) d.style.borderRadius = el.borderRadius + 'px';

        if (el.type === 'text') {
            d.className += ' el-text'; d.contentEditable = !el.locked;
            d.textContent = el.content;
            d.style.fontSize = el.fontSize + 'px'; d.style.fontFamily = el.fontFamily || 'sans-serif';
            d.style.color = el.color || '#000'; d.style.textAlign = el.align || 'left';
            d.style.fontWeight = el.bold ? 'bold' : 'normal'; d.style.fontStyle = el.italic ? 'italic' : 'normal';
            if (el.strokeWidth) d.style.webkitTextStroke = `${el.strokeWidth}px ${el.strokeColor || '#fff'}`;
            if (el.lineHeight) d.style.lineHeight = el.lineHeight;
            if (el.letterSpacing) d.style.letterSpacing = el.letterSpacing + 'px';
            if (el.textShadow) d.style.textShadow = el.textShadow;
            d.addEventListener('input', e => { el.content = e.target.textContent });
        } else if (el.type === 'image') {
            d.className += ' el-img';
            const img = document.createElement('img'); img.src = el.src;
            img.style.objectFit = el.objectFit || 'contain';
            if (el.filter) img.style.filter = el.filter;
            if (el.imgRadius) img.style.borderRadius = el.imgRadius + 'px';
            d.appendChild(img);
        } else if (el.type === 'panel') {
            d.className += ' el-panel';
            d.style.border = `${el.panelBorderWidth || 4}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'}`;
            d.style.borderRadius = (el.panelRadius || 0) + 'px'; d.style.background = el.fill || 'transparent';
            if (el.panelShadow && el.panelShadow !== 'none') d.style.boxShadow = el.panelShadow;
        } else if (el.type === 'shape') {
            d.className += ' el-shape'; d.style.background = el.fill || '#000';
            if (el.shape === 'circle') d.style.borderRadius = '50%';
            if (el.shape === 'diamond') d.style.transform = `rotate(${(el.rotation || 0) + 45}deg)`;
            if (el.shape === 'triangle') { d.style.background = 'transparent'; d.style.width = '0'; d.style.height = '0'; d.style.borderLeft = (el.width / 2) + 'px solid transparent'; d.style.borderRight = (el.width / 2) + 'px solid transparent'; d.style.borderBottom = el.height + 'px solid ' + (el.fill || '#000') }
            if (el.shape === 'line_h') { d.style.borderRadius = '2px' }
        } else if (el.type === 'balloon') {
            d.className += ' el-text'; d.contentEditable = !el.locked; d.textContent = el.content;
            d.style.fontSize = (el.fontSize || 14) + 'px'; d.style.padding = '10px'; d.style.display = 'flex'; d.style.alignItems = 'center'; d.style.justifyContent = 'center'; d.style.textAlign = 'center';
            const bt = el.balloonType || 'dialog';
            if (bt === 'dialog') { d.style.background = '#fff'; d.style.border = '2px solid #000'; d.style.borderRadius = '20px' }
            if (bt === 'thought') { d.style.background = '#fff'; d.style.border = '2px solid #000'; d.style.borderRadius = '50%' }
            if (bt === 'shout') { d.style.background = '#fff'; d.style.border = '4px solid #000'; d.style.fontWeight = 'bold' }
            if (bt === 'caption') { d.style.background = '#000'; d.style.color = '#fff' }
            if (bt === 'whisper') { d.style.background = '#f8f8f8'; d.style.border = '1px dashed #999'; d.style.borderRadius = '16px'; d.style.fontStyle = 'italic' }
            if (bt === 'narration') { d.style.background = '#ffe'; d.style.border = '1px solid #cc9'; d.style.fontStyle = 'italic' }
            d.addEventListener('input', e => { el.content = e.target.textContent });
        } else if (el.type === 'silhouette') {
            d.style.background = el.fill || '#000';
            const clips = { hero1: 'polygon(50% 0%,100% 40%,100% 100%,0% 100%,0% 40%)', villain1: 'polygon(50% 0%,80% 30%,80% 100%,20% 100%,20% 30%)' };
            d.style.clipPath = clips[el.silhouetteId] || clips.hero1;
        }

        // Resize handles + rotation handle
        if (this.sel && this.sel.id === el.id) {
            ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rot'].forEach(pos => {
                const h = document.createElement('div'); h.className = 'rh ' + pos;
                if (pos === 'rot') h.addEventListener('mousedown', e => this.startRotate(e, el));
                else h.addEventListener('mousedown', e => this.startResize(e, el, pos));
                d.appendChild(h);
            });
        }
        d.addEventListener('mousedown', e => this.startDrag(e, el));
        d.addEventListener('click', e => { e.stopPropagation(); this.selectEl(el) });
        return d;
    },

    // Properties Panel
    showProps(el) {
        const c = document.getElementById('propsContent');
        const fonts = ['Crimson Text', 'Cinzel', 'Cinzel Decorative', 'Bebas Neue', 'Special Elite', 'Bangers', 'Playfair Display', 'EB Garamond', 'Orbitron', 'Roboto Mono', 'Montserrat', 'Assistant', 'Comic Neue', 'Courier Prime', 'MedievalSharp', 'Inter'];
        let h = `<div class="prop-row-inline"><div class="prop-row"><label>X</label><input type="number" value="${Math.round(el.x)}" onchange="VP.ed.updProp('x',+this.value)"></div><div class="prop-row"><label>Y</label><input type="number" value="${Math.round(el.y)}" onchange="VP.ed.updProp('y',+this.value)"></div></div>`;
        h += `<div class="prop-row-inline"><div class="prop-row"><label>W</label><input type="number" value="${Math.round(el.width)}" onchange="VP.ed.updProp('width',+this.value)"></div><div class="prop-row"><label>H</label><input type="number" value="${Math.round(el.height)}" onchange="VP.ed.updProp('height',+this.value)"></div></div>`;
        h += `<div class="prop-row"><label>Rotation ${el.rotation || 0}°</label><input type="range" min="0" max="360" value="${el.rotation || 0}" oninput="VP.ed.updProp('rotation',+this.value)"></div>`;
        h += `<div class="prop-row"><label>Opacity ${Math.round((el.opacity ?? 1) * 100)}%</label><input type="range" min="0" max="1" step=".01" value="${el.opacity ?? 1}" oninput="VP.ed.updProp('opacity',+this.value)"></div>`;

        if (el.type === 'text' || el.type === 'balloon') {
            h += `<div class="prop-row"><label>Font Size</label><input type="number" value="${el.fontSize}" onchange="VP.ed.updProp('fontSize',+this.value)"></div>`;
            h += `<div class="prop-row"><label>Font</label><select onchange="VP.ed.updProp('fontFamily',this.value)">${fonts.map(f => `<option value="${f}"${el.fontFamily === f ? ' selected' : ''}>${f}</option>`).join('')}</select></div>`;
            h += `<div class="prop-row"><label>Color</label><input type="color" value="${el.color || '#000000'}" onchange="VP.ed.updProp('color',this.value)"></div>`;
            h += `<div class="prop-row"><label>Align</label><select onchange="VP.ed.updProp('align',this.value)"><option value="left"${el.align === 'left' ? ' selected' : ''}>Left</option><option value="center"${el.align === 'center' ? ' selected' : ''}>Center</option><option value="right"${el.align === 'right' ? ' selected' : ''}>Right</option><option value="justify"${el.align === 'justify' ? ' selected' : ''}>Justify</option></select></div>`;
            h += `<div class="prop-row"><label><input type="checkbox" ${el.bold ? 'checked' : ''} onchange="VP.ed.updProp('bold',this.checked)"> Bold</label></div>`;
            h += `<div class="prop-row"><label><input type="checkbox" ${el.italic ? 'checked' : ''} onchange="VP.ed.updProp('italic',this.checked)"> Italic</label></div>`;
            h += `<div class="prop-row"><label>Line Height</label><input type="text" value="${el.lineHeight || ''}" onchange="VP.ed.updProp('lineHeight',this.value)" placeholder="e.g. 1.6"></div>`;
            h += `<div class="prop-row"><label>Letter Spacing</label><input type="number" value="${el.letterSpacing || 0}" onchange="VP.ed.updProp('letterSpacing',+this.value)"></div>`;
        }
        if (el.type === 'image') {
            h += `<div class="prop-row"><label>Fit</label><select onchange="VP.ed.updProp('objectFit',this.value)"><option value="contain"${el.objectFit === 'contain' ? ' selected' : ''}>Contain</option><option value="cover"${el.objectFit === 'cover' ? ' selected' : ''}>Cover</option><option value="fill"${el.objectFit === 'fill' ? ' selected' : ''}>Fill</option></select></div>`;
            h += `<div class="prop-row"><label>Image Radius</label><input type="number" value="${el.imgRadius || 0}" onchange="VP.ed.updProp('imgRadius',+this.value)"></div>`;
        }
        if (el.type === 'panel' || el.type === 'shape') {
            h += `<div class="prop-row"><label>Fill</label><input type="color" value="${el.fill || '#000000'}" onchange="VP.ed.updProp('fill',this.value)"></div>`;
        }
        if (el.type === 'panel') {
            h += `<div class="prop-row"><label>Border Width</label><input type="number" value="${el.panelBorderWidth || 4}" onchange="VP.ed.updProp('panelBorderWidth',+this.value)"></div>`;
            h += `<div class="prop-row"><label>Border Color</label><input type="color" value="${el.panelBorderColor || '#000'}" onchange="VP.ed.updProp('panelBorderColor',this.value)"></div>`;
            h += `<div class="prop-row"><label>Border Radius</label><input type="number" value="${el.panelRadius || 0}" onchange="VP.ed.updProp('panelRadius',+this.value)"></div>`;
        }

        h += `<div class="prop-row"><label>Blend Mode</label><select onchange="VP.ed.updProp('blendMode',this.value)">${['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'hard-light', 'difference'].map(m => `<option value="${m}"${el.blendMode === m ? ' selected' : ''}>${m}</option>`).join('')}</select></div>`;
        h += `<div class="prop-row-inline"><button class="prop-btn" onclick="VP.ed.moveLayer('up')">▲ Forward</button><button class="prop-btn" onclick="VP.ed.moveLayer('down')">▼ Back</button></div>`;
        h += `<div class="prop-row"><button class="prop-btn danger" onclick="VP.ed.deleteSelected()">✕ Delete Element</button></div>`;
        c.innerHTML = h;
    },

    showEffects(el) {
        const c = document.getElementById('effectsContent');
        let h = '';
        h += `<div class="prop-row"><label>Drop Shadow</label><input type="text" value="${el.shadow || ''}" onchange="VP.ed.updProp('shadow',this.value)" placeholder="2px 2px 8px rgba(0,0,0,.5)"></div>`;
        h += `<div class="prop-row"><label>Blur ${el.blur || 0}px</label><input type="range" min="0" max="20" value="${el.blur || 0}" oninput="VP.ed.updProp('blur',+this.value)"></div>`;
        h += `<div class="prop-row"><label>Border Width</label><input type="number" value="${el.borderWidth || 0}" onchange="VP.ed.updProp('borderWidth',+this.value)"></div>`;
        h += `<div class="prop-row"><label>Border Color</label><input type="color" value="${el.borderColor || '#000000'}" onchange="VP.ed.updProp('borderColor',this.value)"></div>`;
        h += `<div class="prop-row"><label>Border Radius</label><input type="number" value="${el.borderRadius || 0}" onchange="VP.ed.updProp('borderRadius',+this.value)"></div>`;
        if (el.type === 'text') {
            h += `<div class="prop-row"><label>Text Shadow</label><input type="text" value="${el.textShadow || ''}" onchange="VP.ed.updProp('textShadow',this.value)" placeholder="1px 1px 4px #000"></div>`;
            h += `<div class="prop-row"><label>Stroke Width</label><input type="number" value="${el.strokeWidth || 0}" onchange="VP.ed.updProp('strokeWidth',+this.value)"></div>`;
            h += `<div class="prop-row"><label>Stroke Color</label><input type="color" value="${el.strokeColor || '#ffffff'}" onchange="VP.ed.updProp('strokeColor',this.value)"></div>`;
        }
        if (el.type === 'image') {
            h += `<div class="prop-row"><label>CSS Filter</label><input type="text" value="${el.filter || ''}" onchange="VP.ed.updProp('filter',this.value)" placeholder="brightness(1.2) contrast(1.1)"></div>`;
        }
        c.innerHTML = h;
    },

    showPageProps() {
        const c = document.getElementById('propsContent'); const page = this.curPage();
        let h = `<h4 style="font-size:.75em;color:var(--vp-accent);margin-bottom:10px">PAGE PROPERTIES</h4>`;
        h += `<div class="prop-row"><label>Background</label><input type="color" value="${page.background || '#ffffff'}" onchange="VP.ed.updPageProp('background',this.value)"></div>`;
        h += `<div class="prop-row"><label>Texture</label><select onchange="VP.ed.updPageProp('texture',this.value)"><option value="">None</option><option value="https://www.transparenttextures.com/patterns/old-mathematics.png"${page.texture?.includes('old-math') ? 'selected' : ''}>Old Paper</option><option value="https://www.transparenttextures.com/patterns/dark-matter.png"${page.texture?.includes('dark-matter') ? 'selected' : ''}>Dark Matter</option><option value="https://www.transparenttextures.com/patterns/carbon-fibre.png"${page.texture?.includes('carbon') ? 'selected' : ''}>Carbon Fibre</option><option value="https://www.transparenttextures.com/patterns/pinstriped-suit.png"${page.texture?.includes('pinstripe') ? 'selected' : ''}>Pinstripe</option></select></div>`;
        c.innerHTML = h;
    },

    updProp(prop, val) { if (this.sel) { this.sel[prop] = val; this.render(); this.showProps(this.sel); this.showEffects(this.sel); this.pushHistory() } },
    updPageProp(prop, val) { const p = this.curPage(); p[prop] = val; this.render(); this.updateThumbs(); this.pushHistory() },

    // Zoom
    zoom(delta) {
        const canvas = document.getElementById('canvas');
        if (delta === 'fit') { const w = document.getElementById('canvasWrap'); this.zoom = Math.min((w.clientWidth - 80) / canvas.offsetWidth, (w.clientHeight - 80) / canvas.offsetHeight, 1) }
        else this.zoom = Math.max(.25, Math.min(3, this.zoom + delta));
        // fix: the property name collides with method name, use _zoom
        canvas.style.transform = `scale(${this.zoom})`;
        document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';
    },

    setOrientation(o) { document.getElementById('canvas').className = 'ed-canvas ' + o; this.render() },
    toggleGrid() { this.gridOn = !this.gridOn; document.getElementById('canvas').classList.toggle('show-grid', this.gridOn); document.getElementById('gridToggle').classList.toggle('active', this.gridOn) },
    toggleSnap() { this.snapOn = !this.snapOn; document.getElementById('snapToggle').classList.toggle('active', this.snapOn); VP.toast(this.snapOn ? 'Snap on' : 'Snap off', 'info') },

    applyTheme(key) {
        const t = this.themes[key]; if (!t) return;
        if (VP.currentProject) VP.currentProject.theme = key;
        document.getElementById('statusText').textContent = 'REALITY: ' + t.status;
        VP.saveAll(); VP.toast('Theme: ' + key, 'success');
    },

    // Save/Load
    saveProject() {
        if (!VP.currentProject) { VP.toast('No project open', 'error'); return }
        VP.currentProject.pages = this.pages; VP.saveAll(); VP.toast('Project saved!', 'success');
    },

    // Export helpers
    elementToHTML(el) {
        let s = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;transform:rotate(${el.rotation || 0}deg);z-index:${el.zIndex || 0};opacity:${el.opacity ?? 1};mix-blend-mode:${el.blendMode || 'normal'};`;
        let content = '';
        if (el.type === 'text' || el.type === 'balloon') {
            s += `font-size:${el.fontSize}px;font-family:${el.fontFamily || 'sans-serif'};color:${el.color || '#000'};text-align:${el.align || 'left'};`;
            if (el.bold) s += 'font-weight:bold;'; if (el.italic) s += 'font-style:italic;';
            content = el.content || '';
            if (el.type === 'balloon') {
                if (el.balloonType === 'dialog') s += 'background:#fff;border:2px solid #000;border-radius:20px;padding:10px;';
                if (el.balloonType === 'thought') s += 'background:#fff;border:2px solid #000;border-radius:50%;padding:10px;';
                if (el.balloonType === 'shout') s += 'background:#fff;border:4px solid #000;padding:10px;font-weight:bold;';
                if (el.balloonType === 'caption') s += 'background:#000;color:#fff;padding:10px;';
            }
        }
        if (el.type === 'image') content = `<img src="${el.src}" style="width:100%;height:100%;object-fit:${el.objectFit || 'cover'}">`;
        if (el.type === 'panel') s += `border:${el.panelBorderWidth || 0}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'};background:${el.fill || 'transparent'};border-radius:${el.panelRadius || 0}px;`;
        if (el.type === 'shape') { s += `background:${el.fill || '#000'};`; if (el.shape === 'circle') s += 'border-radius:50%;' }
        if (el.shadow) s += `box-shadow:${el.shadow};`;
        return `<div style="${s}">${content}</div>`;
    },

    async exportPDF() {
        const ld = document.getElementById('loadingOverlay'); ld.classList.add('active');
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [5.5, 8.5] });
            for (let i = 0; i < this.pages.length; i++) {
                if (i > 0) pdf.addPage(); this.goToPage(i); await new Promise(r => setTimeout(r, 100));
                const canvas = document.getElementById('canvas');
                const img = await html2canvas(canvas, { scale: 2, backgroundColor: '#fff' });
                pdf.addImage(img.toDataURL('image/png'), 'PNG', 0, 0, 5.5, 8.5);
            }
            pdf.save('voidpress-zine.pdf'); VP.toast('PDF exported!', 'success');
        } catch (e) { console.error(e); VP.toast('Export failed', 'error') }
        ld.classList.remove('active'); VP.closeModal('exportModal');
    },

    exportHTML() {
        const ld = document.getElementById('loadingOverlay'); ld.classList.add('active');
        setTimeout(() => {
            let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Void Press Zine</title><style>body{margin:0;padding:20px;background:#111;font-family:Arial,sans-serif}.page-wrap{max-width:528px;margin:0 auto;display:none}.page-wrap.active{display:block}.page{position:relative;width:100%;aspect-ratio:5.5/8.5;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.5);margin-bottom:20px;overflow:hidden}.el{position:absolute}.nav{text-align:center;padding:20px}.btn{padding:10px 24px;background:#d4af37;color:#000;border:none;cursor:pointer;font-weight:600;margin:0 8px;border-radius:6px}#pg{color:#aaa;margin:0 16px}</style></head><body>`;
            this.pages.forEach((p, i) => {
                html += `<div class="page-wrap${i === 0 ? ' active' : ''}" id="p${i}"><div class="page" style="background:${p.background}">`;
                if (p.texture) html += `<div style="position:absolute;inset:0;background-image:url('${p.texture}');background-size:cover;opacity:.2"></div>`;
                p.elements.filter(e => !e.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach(e => { html += this.elementToHTML(e) });
                html += `</div></div>`;
            });
            const sc = `let c=0,t=${this.pages.length};function show(n){for(let i=0;i<t;i++){const e=document.getElementById('p'+i);if(e)e.className='page-wrap'+(i===n?' active':'');}document.getElementById('pg').textContent=(n+1)+'/'+t;}function next(){if(c<t-1){c++;show(c)}}function prev(){if(c>0){c--;show(c)}}`;
            html += `<div class="nav"><button class="btn" onclick="prev()">◀ Prev</button><span id="pg">1/${this.pages.length}</span><button class="btn" onclick="next()">Next ▶</button></div><` + `script>${sc}<` + `/script></body></html>`;
            const blob = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'voidpress-zine.html'; a.click();
            ld.classList.remove('active'); VP.closeModal('exportModal'); VP.toast('HTML exported!', 'success');
        }, 300);
    },

    exportInteractive() {
        const ld = document.getElementById('loadingOverlay'); ld.classList.add('active');
        setTimeout(() => {
            let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Void Press Interactive</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0f;display:flex;justify-content:center;align-items:center;height:100vh;perspective:2000px;overflow:hidden;font-family:sans-serif}.book{position:relative;width:420px;height:648px;transform-style:preserve-3d}.pg{position:absolute;width:100%;height:100%;background:#fff;box-shadow:0 5px 25px rgba(0,0,0,.5);transform-origin:left;transition:transform .8s cubic-bezier(.645,.045,.355,1);backface-visibility:hidden;overflow:hidden}.pg.flip{transform:rotateY(-180deg)}.ctrl{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:16px;z-index:100}.btn{padding:10px 24px;background:#d4af37;border:none;color:#000;cursor:pointer;border-radius:6px;font-weight:600}.btn:hover{transform:scale(1.05)}</style></head><body><div class="book" id="bk">`;
            this.pages.forEach((p, i) => {
                html += `<div class="pg" id="pg${i}" style="z-index:${this.pages.length - i};background:${p.background}">`;
                if (p.texture) html += `<div style="position:absolute;inset:0;background-image:url('${p.texture}');background-size:cover;opacity:.2;pointer-events:none"></div>`;
                p.elements.filter(e => !e.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach(e => { html += this.elementToHTML(e) });
                html += `</div>`;
            });
            const sc = `let c=0,t=${this.pages.length};function next(){if(c<t-1){document.getElementById('pg'+c).classList.add('flip');c++}}function prev(){if(c>0){c--;document.getElementById('pg'+c).classList.remove('flip')}}document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')next();if(e.key==='ArrowLeft')prev()})`;
            html += `</div><div class="ctrl"><button class="btn" onclick="prev()">◀ PREV</button><button class="btn" onclick="next()">NEXT ▶</button></div><` + `script>${sc}<` + `/script></body></html>`;
            const blob = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'voidpress-interactive.html'; a.click();
            ld.classList.remove('active'); VP.closeModal('exportModal'); VP.toast('Interactive exported!', 'success');
        }, 500);
    }
};

// Fix zoom property collision - rename internal zoom level
(function () {
    let _zoomLevel = 1;
    const origZoom = VP.ed.zoom.bind(VP.ed);
    Object.defineProperty(VP.ed, 'zoom', { get() { return _zoomLevel }, set(v) { _zoomLevel = v } });
    VP.ed.doZoom = function (delta) {
        const canvas = document.getElementById('canvas');
        if (delta === 'fit') { const w = document.getElementById('canvasWrap'); _zoomLevel = Math.min((w.clientWidth - 80) / canvas.offsetWidth, (w.clientHeight - 80) / canvas.offsetHeight, 1) }
        else _zoomLevel = Math.max(.25, Math.min(3, _zoomLevel + delta));
        canvas.style.transform = `scale(${_zoomLevel})`;
        document.getElementById('zoomLevel').textContent = Math.round(_zoomLevel * 100) + '%';
    };
    // Rebind the zoom buttons
    VP.ed._origZoom = VP.ed.doZoom;
})();
// Override zoom calls in HTML to use doZoom
const _origInit = VP.ed.init;
VP.ed.init = function () {
    _origInit.call(this);
    // Re-bind zoom button handlers
    document.querySelectorAll('.zoom-group button').forEach(b => {
        const oc = b.getAttribute('onclick');
        if (oc && oc.includes('zoom')) {
            b.removeAttribute('onclick');
            if (oc.includes("-.1")) b.onclick = () => VP.ed.doZoom(-.1);
            else if (oc.includes(".1")) b.onclick = () => VP.ed.doZoom(.1);
            else if (oc.includes("'fit'")) b.onclick = () => VP.ed.doZoom('fit');
        }
    });
};
