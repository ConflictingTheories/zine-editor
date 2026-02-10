// ═══════════════════════════════════════════
// VOID PRESS - Core Application Engine
// ═══════════════════════════════════════════

const VP = {
    projects: JSON.parse(localStorage.getItem('vp_projects') || '[]'),
    published: JSON.parse(localStorage.getItem('vp_published') || '[]'),
    currentProject: null,
    isPremium: localStorage.getItem('vp_premium') === 'true',
    selectedTheme: 'classic',

    // ── VIEW MANAGEMENT ──
    showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.topnav-tab').forEach(t => t.classList.remove('active'));
        const el = document.getElementById('view-' + name);
        if (el) el.classList.add('active');
        document.querySelectorAll('.topnav-tab').forEach(t => { if (t.dataset.view === name) t.classList.add('active') });
        if (name === 'dashboard') this.renderDashboard();
        if (name === 'discover') this.disc.render();
    },

    toast(msg, type = 'info') {
        const c = document.getElementById('toastContainer');
        const t = document.createElement('div');
        t.className = 'toast ' + type; t.textContent = msg; c.appendChild(t);
        setTimeout(() => { t.style.animation = 'fadeOut .3s ease forwards'; setTimeout(() => t.remove(), 300) }, 3000);
    },

    showModal(id, subtype) {
        if (id === 'assetModal' && subtype) this.renderAssetModal(subtype);
        document.getElementById(id).classList.add('active');
    },
    closeModal(id) { document.getElementById(id).classList.remove('active') },

    // ── DASHBOARD ──
    renderDashboard() {
        const g = document.getElementById('zineGrid');
        const pubCount = this.published.length;
        const totalReads = this.published.reduce((s, p) => s + (p.reads || 0), 0);
        document.getElementById('statTotal').textContent = this.projects.length;
        document.getElementById('statPublished').textContent = pubCount;
        document.getElementById('statReads').textContent = totalReads;
        const maxPub = this.isPremium ? '∞' : '3';
        document.getElementById('statLimit').textContent = pubCount + '/' + maxPub;
        document.getElementById('tierBadge').textContent = this.isPremium ? 'PREMIUM' : 'FREE';
        document.getElementById('tierBadge').className = 'user-tier' + (this.isPremium ? ' premium' : '');

        let html = '<div class="zine-card create-card" onclick="VP.showThemePicker()"><div class="zine-card-cover"><div class="cover-icon">+</div></div><div class="zine-card-body"><h3>Create New Zine</h3><p>Start a new project</p></div></div>';
        this.projects.forEach((p, i) => {
            const isPub = this.published.find(x => x.projectId === p.id);
            const badge = isPub ? '<span class="zine-card-badge badge-published">Published</span>' : '<span class="zine-card-badge badge-draft">Draft</span>';
            const colors = this.ed.themes[p.theme || 'classic'];
            const bg = colors ? `background:linear-gradient(135deg,${colors['--ed-black'] || '#1a1a1a'},${colors['--ed-gray'] || '#34495e'})` : '';
            html += `<div class="zine-card"><div class="zine-card-cover" style="${bg}">${badge}<div class="cover-icon" style="color:${colors?.['--ed-gold'] || '#d4af37'}">📖</div></div><div class="zine-card-body"><h3>${p.title || 'Untitled Zine'}</h3><p>${p.pages?.length || 0} pages · ${p.theme || 'classic'}</p><div class="zine-card-actions"><button onclick="event.stopPropagation();VP.openProject(${i})">Edit</button><button onclick="event.stopPropagation();VP.renameProject(${i})">Rename</button><button class="del" onclick="event.stopPropagation();VP.deleteProject(${i})">Delete</button></div></div></div>`;
        });
        g.innerHTML = html;
    },

    showThemePicker() {
        const grid = document.getElementById('themePickerGrid');
        const themes = { classic: { name: 'Classic Literature', desc: 'Elegant prose & serif beauty', colors: ['#5c0a0a', '#d4af37', '#fdfaf1', '#4b2c5e'] }, fantasy: { name: 'Medieval Fantasy', desc: 'Swords, sorcery & scrolls', colors: ['#8b0000', '#ffd700', '#f5f5dc', '#4b0082'] }, cyberpunk: { name: 'Cyberpunk', desc: 'Neon grids & digital void', colors: ['#ff003c', '#00f3ff', '#fcee0a', '#bc00ff'] }, conspiracy: { name: 'Dark Conspiracies', desc: 'Redacted truths & shadows', colors: ['#4a0000', '#00ff00', '#c5b358', '#e8e4d9'] }, worldbuilding: { name: 'World Building', desc: 'Maps, lore & kingdoms', colors: ['#e74c3c', '#27ae60', '#f1c40f', '#8e44ad'] }, comics: { name: 'Comics', desc: 'POW! BAM! WHAM!', colors: ['#ff0000', '#ffd700', '#663399', '#32cd32'] }, arcane: { name: 'Arcane Lore', desc: 'Sigils, runes & the unknowable', colors: ['#6a040f', '#ff9e00', '#3c096c', '#70e000'] } };
        let html = '';
        Object.entries(themes).forEach(([k, v]) => {
            html += `<div class="theme-card ${k === this.selectedTheme ? 'selected' : ''}" onclick="VP.selectTheme('${k}',this)"><h4>${v.name}</h4><p>${v.desc}</p><div class="color-row">${v.colors.map(c => `<div class="color-dot" style="background:${c}"></div>`).join('')}</div></div>`;
        });
        grid.innerHTML = html;
        this.showModal('themePickerModal');
    },

    selectTheme(key, el) {
        this.selectedTheme = key;
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    },

    createZineWithTheme() {
        const project = { id: Date.now(), title: 'Untitled Zine', theme: this.selectedTheme, pages: [{ id: Date.now(), elements: [], background: '#ffffff', texture: null }], created: new Date().toISOString() };
        this.projects.push(project);
        this.saveAll();
        this.closeModal('themePickerModal');
        this.currentProject = project;
        this.ed.loadProject(project);
        this.showView('editor');
        this.toast('New zine created!', 'success');
    },

    openProject(idx) {
        this.currentProject = this.projects[idx];
        this.ed.loadProject(this.currentProject);
        this.showView('editor');
    },

    renameProject(idx) {
        const name = prompt('New name:', this.projects[idx].title);
        if (name) { this.projects[idx].title = name; this.saveAll(); this.renderDashboard() }
    },

    deleteProject(idx) {
        if (confirm('Delete this zine permanently?')) {
            const id = this.projects[idx].id;
            this.projects.splice(idx, 1);
            this.published = this.published.filter(p => p.projectId !== id);
            this.saveAll(); this.renderDashboard(); this.toast('Zine deleted', 'error');
        }
    },

    saveAll() {
        localStorage.setItem('vp_projects', JSON.stringify(this.projects));
        localStorage.setItem('vp_published', JSON.stringify(this.published));
    },

    // ── PUBLISHING ──
    publishZine() {
        if (!this.currentProject) { this.toast('No project open', 'error'); return }
        if (!document.getElementById('pubGuidelines').checked) { this.toast('Please accept guidelines', 'error'); return }
        const title = document.getElementById('pubTitle').value || this.currentProject.title;
        if (!title) { this.toast('Title required', 'error'); return }
        const existing = this.published.find(p => p.projectId === this.currentProject.id);
        if (!existing && !this.isPremium && this.published.length >= 3) {
            this.closeModal('publishModal'); this.showModal('premiumModal');
            this.toast('Free tier limit reached (3 zines)', 'error'); return;
        }
        const pub = { projectId: this.currentProject.id, title, author: document.getElementById('pubAuthor').value || 'Anonymous', description: document.getElementById('pubDesc').value || '', genre: document.getElementById('pubGenre').value, tags: (document.getElementById('pubTags').value || '').split(',').map(t => t.trim()).filter(Boolean), visibility: document.getElementById('pubVisibility').value, pages: JSON.parse(JSON.stringify(this.currentProject.pages)), theme: this.currentProject.theme, publishedAt: new Date().toISOString(), reads: existing?.reads || 0 };
        if (existing) { const idx = this.published.indexOf(existing); this.published[idx] = pub }
        else this.published.push(pub);
        this.saveAll(); this.closeModal('publishModal'); this.toast('🚀 Zine published!', 'success');
    },

    showPremiumModal() { this.showModal('premiumModal') },
    upgradePremium() { this.isPremium = true; localStorage.setItem('vp_premium', 'true'); this.closeModal('premiumModal'); this.renderDashboard(); this.toast('Welcome to Premium! 🎉', 'success') },

    // ── ASSET MODAL ──
    renderAssetModal(type) {
        const titles = { panels: 'Comic Panels', shapes: 'Shapes & Borders', balloons: 'Speech Balloons', sfx: 'Sound Effects', symbols: 'Symbols & Icons' };
        document.getElementById('assetModalTitle').textContent = titles[type] || 'Assets';
        const assets = this.ed.getAssets(type);
        let html = '<div class="asset-grid">';
        assets.forEach(a => { html += `<div class="asset-item" onclick="VP.ed.addAsset('${type}','${a.id}');VP.closeModal('assetModal')">${a.preview}</div>` });
        html += '</div>';
        document.getElementById('assetModalBody').innerHTML = html;
    },

    switchExportTab(btn, id) {
        document.querySelectorAll('.export-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.export-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active'); document.getElementById(id).classList.add('active');
    },

    // ── DISCOVER ──
    disc: {
        currentFilter: 'all', searchQuery: '',
        render() {
            const grid = document.getElementById('discoverGrid');
            let items = VP.published.filter(p => p.visibility === 'public');
            if (this.currentFilter !== 'all') items = items.filter(p => p.genre === this.currentFilter);
            if (this.searchQuery) { const q = this.searchQuery.toLowerCase(); items = items.filter(p => (p.title + p.author + p.description + p.tags.join(' ')).toLowerCase().includes(q)) }
            if (!items.length) { grid.innerHTML = '<p style="color:var(--vp-text-dim);grid-column:1/-1;text-align:center;padding:60px 0;font-size:1.1em">No zines found. Be the first to publish!</p>'; return }
            const themeIcons = { classic: '📜', fantasy: '⚔️', cyberpunk: '🌐', conspiracy: '🔍', worldbuilding: '🗺️', comics: '💥', arcane: '🔮' };
            let html = '';
            items.forEach((p, i) => {
                const colors = VP.ed.themes[p.theme || 'classic'];
                const bg = colors ? `background:linear-gradient(135deg,${colors['--ed-black'] || '#1a1a1a'},${colors['--ed-gray'] || '#34495e'})` : '';
                html += `<div class="discover-card" onclick="VP.openReader(${i})"><div class="discover-card-cover" style="${bg}"><div class="cover-bg">${themeIcons[p.genre] || '📖'}</div></div><div class="discover-card-body"><h3>${p.title}</h3><div class="author">by ${p.author}</div><div class="meta"><span>📖 ${p.pages?.length || 0} pages</span><span>👁 ${p.reads || 0} reads</span></div><div class="discover-card-tags">${p.tags.map(t => `<span>${t}</span>`).join('')}</div></div></div>`;
            });
            grid.innerHTML = html;
        },
        filter(genre, btn) {
            this.currentFilter = genre;
            document.querySelectorAll('.filter-tag').forEach(f => f.classList.remove('active'));
            btn.classList.add('active'); this.render();
        },
        search(q) { this.searchQuery = q; this.render() }
    },

    // ── READER ──
    openReader(idx) {
        const items = VP.published.filter(p => p.visibility === 'public');
        let filtered = items;
        if (this.disc.currentFilter !== 'all') filtered = filtered.filter(p => p.genre === this.disc.currentFilter);
        const pub = filtered[idx]; if (!pub) return;
        pub.reads = (pub.reads || 0) + 1; this.saveAll();
        this.reader.load(pub); this.showView('reader');
    },
    closeReader() { this.showView('discover') },
    reader: {
        data: null, pageIdx: 0,
        load(pub) { this.data = pub; this.pageIdx = 0; this.renderPage() },
        renderPage() {
            if (!this.data) return;
            const book = document.getElementById('readerBook');
            const page = this.data.pages[this.pageIdx];
            if (!page) { book.innerHTML = ''; return }
            let html = `<div class="reader-page" style="background:${page.background || '#fff'}">`;
            if (page.texture) html += `<div style="position:absolute;inset:0;background-image:url('${page.texture}');background-size:cover;opacity:.2;pointer-events:none"></div>`;
            (page.elements || []).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach(el => { html += VP.ed.elementToHTML(el) });
            html += '</div>';
            book.innerHTML = html;
            document.getElementById('readerPageNum').textContent = (this.pageIdx + 1) + ' / ' + this.data.pages.length;
        },
        next() { if (this.data && this.pageIdx < this.data.pages.length - 1) { this.pageIdx++; this.renderPage() } },
        prev() { if (this.pageIdx > 0) { this.pageIdx--; this.renderPage() } }
    },

    // ── INIT ──
    init() {
        this.renderDashboard();
        this.ed.init();
        document.addEventListener('click', () => document.getElementById('ctxMenu').classList.remove('active'));
        document.addEventListener('keydown', e => {
            if (e.key === '?' && !e.ctrlKey) { document.getElementById('shortcutsOverlay').classList.toggle('active'); return }
            if (!this.currentProject) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.ed.undo() }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); this.ed.redo() }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') this.ed.copyElement();
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); this.ed.pasteElement() }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.ed.saveProject() }
            if (e.key === 'Delete' || e.key === 'Backspace' && !e.target.isContentEditable) this.ed.deleteSelected();
            if (e.key === 'Escape') this.ed.deselectAll();
            if (e.key === 'g' && !e.ctrlKey && !e.target.isContentEditable) this.ed.toggleGrid();
        });
    }
};
