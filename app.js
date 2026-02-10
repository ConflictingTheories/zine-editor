// ═══════════════════════════════════════════
// VOID PRESS - Core Application Engine (PWA)
// ═══════════════════════════════════════════

const VP = {
    // State
    projects: JSON.parse(localStorage.getItem('vp_projects') || '[]'),
    published: [], // Loaded from API
    currentProject: null,
    isPremium: false,
    selectedTheme: 'classic',
    user: JSON.parse(localStorage.getItem('vp_user')),
    token: localStorage.getItem('vp_token'),
    isOnline: navigator.onLine,

    // ── AUDIO MANAGER ──
    am: {
        current: null, sfx: {},
        playBGM(url) {
            if (this.current && this.current.src === url) return;
            this.stopBGM();
            if (!url) return;
            this.current = new Audio(url);
            this.current.loop = true;
            this.current.volume = 0.5;
            this.current.play().catch(e => console.warn("Audio blocked", e));
        },
        stopBGM() { if (this.current) { this.current.pause(); this.current = null; } },
        playSFX(url) {
            const a = new Audio(url);
            a.volume = 0.7;
            a.play().catch(e => console.warn("SFX blocked", e));
        }
    },
    isSyncing: false,

    // ── API & SYNC ──
    async api(endpoint, method = 'GET', body = null) {
        if (!this.isOnline) throw new Error('Offline');
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const res = await fetch('/api' + endpoint, { method, headers, body: body ? JSON.stringify(body) : null });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) this.logout();
            throw new Error(await res.text());
        }
        return res.json();
    },

    async sync() {
        if (!this.isOnline || !this.token || this.isSyncing) return;
        this.isSyncing = true;
        this.updateCloudIcon('syncing');
        try {
            // Push unsynced local projects
            for (const p of this.projects) {
                if (p._dirty) {
                    const res = await this.api('/zines', 'POST', { serverId: p.serverId, title: p.title, data: p.pages, theme: p.theme });
                    p.serverId = res.id;
                    delete p._dirty;
                }
            }
            this.saveLocal();
            // Pull remote projects (simple overwrite for MVP, ideally merge)
            const remote = await this.api('/zines');
            remote.forEach(r => {
                const local = this.projects.find(p => p.serverId === r.id);
                if (!local) {
                    // New remote project
                    this.projects.push({ id: Date.now(), serverId: r.id, title: r.title, theme: 'classic', pages: [], _remote: true });
                }
            });
            this.saveLocal();
            this.updateCloudIcon('online');
            this.renderDashboard();
        } catch (e) {
            console.error('Sync failed', e);
            this.updateCloudIcon('error');
        }
        this.isSyncing = false;
    },

    updateCloudIcon(status) {
        const el = document.getElementById('cloudStatus');
        if (!el) return;
        if (status === 'online') el.textContent = '☁️'; // Synced
        if (status === 'offline') el.textContent = '☁️⃠'; // Offline
        if (status === 'syncing') el.textContent = '🔄'; // Syncing
        if (status === 'error') el.textContent = '⚠️'; // Error
        el.title = status.toUpperCase();
    },

    // ── AUTH ──
    showAuth() { this.showModal('authModal'); },
    toggleAuthMode() {
        const isLogin = document.getElementById('authTitle').textContent === 'Login';
        document.getElementById('authTitle').textContent = isLogin ? 'Register' : 'Login';
        document.getElementById('authUserGroup').style.display = isLogin ? 'block' : 'none';
        document.getElementById('authToggleBtn').textContent = isLogin ? 'Have an account?' : 'Need an account?';
        document.querySelector('#authModal .btn-primary').textContent = isLogin ? 'Register' : 'Login';
    },
    async submitAuth() {
        const isRegister = document.getElementById('authTitle').textContent === 'Register';
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPass').value;
        const username = document.getElementById('authUser').value;

        try {
            const endpoint = isRegister ? '/auth/register' : '/auth/login';
            const body = isRegister ? { email, password, username } : { email, password };
            const res = await this.api(endpoint, 'POST', body);

            this.token = res.token;
            this.user = res.user;
            localStorage.setItem('vp_token', this.token);
            localStorage.setItem('vp_user', JSON.stringify(this.user));

            this.closeModal('authModal');
            this.toast(`Welcome, ${this.user.username}!`, 'success');
            this.renderDashboard();
            this.sync();
        } catch (e) {
            alert(e.message || 'Auth failed');
        }
    },
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('vp_token');
        localStorage.removeItem('vp_user');
        this.toast('Logged out', 'info');
        this.renderDashboard();
    },

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
        const userPubs = this.published.filter(p => p.author === this.user?.username); // simple client filter
        const pubCount = userPubs.length; // Approximate
        const totalReads = userPubs.reduce((s, p) => s + (p.reads || 0), 0);

        document.getElementById('statTotal').textContent = this.projects.length;
        document.getElementById('statPublished').textContent = pubCount;
        document.getElementById('statReads').textContent = totalReads;
        const maxPub = this.isPremium ? '∞' : '3';
        document.getElementById('statLimit').textContent = pubCount + '/' + maxPub;

        const tierEl = document.getElementById('tierBadge');
        tierEl.textContent = this.user?.is_premium ? 'PREMIUM' : 'FREE';
        tierEl.className = 'user-tier' + (this.user?.is_premium ? ' premium' : '');

        let html = '<div class="zine-card create-card" onclick="VP.showThemePicker()"><div class="zine-card-cover"><div class="cover-icon">+</div></div><div class="zine-card-body"><h3>Create New Zine</h3><p>Start a new project</p></div></div>';

        if (this.projects.length === 0) {
            html = `<div style="text-align:center;padding:60px;background:var(--vp-surface2);border:1px dashed var(--vp-border);border-radius:var(--radius-lg);grid-column:1/-1">
                <p style="color:var(--vp-text-dim);margin-bottom:20px">No zines found in your library.</p>
                <button class="topnav-btn" onclick="VP.resetDemo()">Load Tutorial Zine</button>
            </div>`;
        } else {
            html = `<div class="zine-card create-card" onclick="VP.showThemePicker()">
                <div class="zine-card-cover"><div class="cover-icon">+</div></div>
                <div class="zine-card-body"><h3>Create New Zine</h3><p>Start a new project</p></div>
            </div>`;
            this.projects.forEach((p, i) => {
                const isPub = p.serverId && this.published.find(x => x.id === p.serverId);
                const badge = isPub ? '<span class="zine-card-badge badge-published">Published</span>' : '<span class="zine-card-badge badge-draft">Draft</span>';
                const colors = this.ed.themes[p.theme || 'classic'];
                const bg = colors ? `background:linear-gradient(135deg,${colors['--ed-black'] || '#1a1a1a'},${colors['--ed-gray'] || '#34495e'})` : '';
                const statusIcon = p._dirty ? '☁️⃠' : '☁️';
                html += `<div class="zine-card"><div class="zine-card-cover" style="${bg}">${badge}<div class="cover-icon" style="color:${colors?.['--ed-gold'] || '#d4af37'}">📖</div></div><div class="zine-card-body"><h3>${p.title || 'Untitled Zine'} <span style="font-size:12px">${statusIcon}</span></h3><p>${p.pages?.length || 0} pages · ${p.theme || 'classic'}</p><div class="zine-card-actions"><button onclick="event.stopPropagation();VP.openProject(${i})">Edit</button><button onclick="event.stopPropagation();VP.renameProject(${i})">Rename</button><button class="del" onclick="event.stopPropagation();VP.deleteProject(${i})">Delete</button></div></div></div>`;
            });
        }
        g.innerHTML = html;
        if (this.projects.length > 0) {
            const wrap = document.createElement('div');
            wrap.style.cssText = "grid-column:1/-1;text-align:right;margin-top:20px";
            wrap.innerHTML = `<button class="ed-tool" style="opacity:.5" onclick="VP.resetDemo()">🔄 Reset Tutorial Zine</button>`;
            g.appendChild(wrap);
        } // Show login prompt if no user
        if (!this.user) {
            document.querySelector('.user-profile').innerHTML = '<button onclick="VP.showAuth()" class="btn-primary" style="padding:4px 12px;font-size:12px">Login</button>';
        } else {
            document.querySelector('.user-profile').innerHTML = `<div style="display:flex;align-items:center;gap:8px"><div class="avatar">${this.user.username[0]}</div><button onclick="VP.logout()" style="background:none;border:none;color:#fff;cursor:pointer">Logout</button></div>`;
        }
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
        const project = { id: Date.now(), title: 'Untitled Zine', theme: this.selectedTheme, pages: [{ id: Date.now(), elements: [], background: '#ffffff', texture: null }], created: new Date().toISOString(), _dirty: true };
        this.projects.push(project);
        this.saveLocal();
        this.closeModal('themePickerModal');
        this.currentProject = project;
        this.ed.loadProject(project);
        this.showView('editor');
        this.toast('New zine created!', 'success');
        this.sync();
    },

    openProject(idx) {
        // If remote only (no data), fetch it
        const p = this.projects[idx];
        if (p._remote) {
            this.toast('Downloading zine...', 'info');
            this.api(`/zines/${p.serverId}`).then(res => {
                p.pages = res.data;
                delete p._remote;
                this.saveLocal();
                this.currentProject = p;
                this.ed.loadProject(p);
                this.showView('editor');
            }).catch(e => this.toast('Failed to load zine', 'error'));
        } else {
            this.currentProject = p;
            this.ed.loadProject(this.currentProject);
            this.showView('editor');
        }
    },

    renameProject(idx) {
        const name = prompt('New name:', this.projects[idx].title);
        if (name) { this.projects[idx].title = name; this.projects[idx]._dirty = true; this.saveLocal(); this.renderDashboard(); this.sync(); }
    },

    deleteProject(idx) {
        if (confirm('Delete this zine permanently?')) {
            const p = this.projects[idx];
            this.projects.splice(idx, 1);
            this.saveLocal(); this.renderDashboard(); this.toast('Zine deleted', 'error');
            if (p.serverId && this.token) {
                this.api(`/zines/${p.serverId}`, 'DELETE').catch(console.error);
            }
        }
    },

    resetDemo() {
        if (this.projects.some(p => p.id === 'tutorial_zine')) {
            if (!confirm('The tutorial is already in your library. Reset it to original?')) return;
            this.projects = this.projects.filter(p => p.id !== 'tutorial_zine');
        }
        const demo = window.getTutorialData();
        demo._dirty = true;
        this.projects.unshift(demo);
        this.saveLocal();
        this.renderDashboard();
        this.toast('Tutorial Loaded!', 'success');
    },

    showHelp() {
        this.showModal('helpModal');
    },

    showHelpTab(id, btn) {
        document.querySelectorAll('.help-nav-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.help-pane').forEach(p => p.classList.toggle('active', p.id === 'help-' + id));
    },

    saveLocal() {
        localStorage.setItem('vp_projects', JSON.stringify(this.projects));
    },

    // ── PUBLISHING ──
    async publishZine() {
        if (!this.currentProject) { this.toast('No project open', 'error'); return }
        if (!document.getElementById('pubGuidelines').checked) { this.toast('Please accept guidelines', 'error'); return }
        const title = document.getElementById('pubTitle').value || this.currentProject.title;
        if (!title) { this.toast('Title required', 'error'); return }

        // Must appear synced first?
        if (!this.currentProject.serverId) {
            this.currentProject._dirty = true;
            // Force sync first
            await this.sync();
            if (!this.currentProject.serverId) { this.toast('Must be online and synced to publish', 'error'); return; }
        }

        const pubData = {
            author_name: document.getElementById('pubAuthor').value || this.user?.username || 'Anonymous',
            genre: document.getElementById('pubGenre').value,
            tags: (document.getElementById('pubTags').value || '').split(',').map(t => t.trim()).filter(Boolean).join(',')
        };

        try {
            await this.api(`/publish/${this.currentProject.serverId}`, 'POST', pubData);
            this.saveLocal(); this.closeModal('publishModal'); this.toast('🚀 Zine published!', 'success');
            this.disc.render(); // refresh discover
        } catch (e) {
            this.toast('Publish failed: ' + e.message, 'error');
        }
    },

    showPremiumModal() { this.showModal('premiumModal') },
    upgradePremium() { this.isPremium = true; localStorage.setItem('vp_premium', 'true'); this.closeModal('premiumModal'); this.renderDashboard(); this.toast('Welcome to Premium! 🎉', 'success') },

    // ── ASSET MODAL ──
    renderAssetModal(type) {
        const titles = { panels: 'Comic Panels', shapes: 'Shapes & Borders', balloons: 'Speech Balloons', sfx: 'Sound Effects', symbols: 'Symbols & Icons', shaders: 'Shader Blocks' };
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
        async render() {
            const grid = document.getElementById('discoverGrid');
            grid.innerHTML = '<p>Loading...</p>';
            try {
                // Fetch from API
                let url = '/published?';
                if (this.currentFilter !== 'all') url += `genre=${this.currentFilter}&`;
                if (this.searchQuery) url += `q=${this.searchQuery}`;

                const items = await VP.api(url);
                if (!items.length) { grid.innerHTML = '<p style="color:var(--vp-text-dim);grid-column:1/-1;text-align:center;padding:60px 0;font-size:1.1em">No zines found. Be the first to publish!</p>'; return }

                const themeIcons = { classic: '📜', fantasy: '⚔️', cyberpunk: '🌐', conspiracy: '🔍', worldbuilding: '🗺️', comics: '💥', arcane: '🔮' };
                let html = '';
                items.forEach((p, i) => {
                    const bg = `background:linear-gradient(135deg,#1a1a1a,#34495e)`; // Cannot read theme from summary list easily w/o extra query, simulate for now
                    html += `<div class="discover-card" onclick="VP.openReader(${p.id})"><div class="discover-card-cover" style="${bg}"><div class="cover-bg">${themeIcons[p.genre] || '📖'}</div></div><div class="discover-card-body"><h3>${p.title}</h3><div class="author">by ${p.author_name}</div><div class="meta"><span>Published ${new Date(p.published_at).toLocaleDateString()}</span><span>👁 ${p.read_count || 0} reads</span></div><div class="discover-card-tags">${(p.tags || '').split(',').map(t => `<span>${t}</span>`).join('')}</div></div></div>`;
                });
                grid.innerHTML = html;
            } catch (e) {
                grid.innerHTML = '<p>Offline or error loading feed.</p>';
            }
        },
        filter(genre, btn) {
            this.currentFilter = genre;
            document.querySelectorAll('.filter-tag').forEach(f => f.classList.remove('active'));
            btn.classList.add('active'); this.render();
        },
        search(q) { this.searchQuery = q; this.render() }
    },

    // ── READER ──
    previewProject() {
        if (!this.currentProject) return;
        this.currentProject.pages = this.ed.pages;
        this.saveLocal();
        const previewData = JSON.parse(JSON.stringify(this.currentProject));
        previewData.data = previewData.pages;
        this.reader.mode = 'preview';
        this.reader.load(previewData);
        this.showView('reader');
    },

    async openReader(id) {
        try {
            this.reader.mode = 'read';
            const pub = await this.api(`/zines/${id}`);
            this.reader.load(pub);
            this.showView('reader');
        } catch (e) { console.error(e); this.toast('Failed to load zine', 'error'); }
    },
    closeReader() {
        this.am.stopBGM();
        if (this.reader.mode === 'preview') {
            this.showView('editor');
        } else {
            this.showView('discover');
        }
        this.reader.mode = 'read';
    },
    reader: {
        data: null, pageIdx: 0, unlockedPages: new Set(),
        load(pub) {
            this.data = pub;
            this.data.pages = pub.data;
            this.pageIdx = 0;
            this.unlockedPages = new Set();
            this.renderPage();
        },
        renderPage() {
            if (!this.data) return;
            const book = document.getElementById('readerBook');
            const page = this.data.pages[this.pageIdx];
            if (!page) { book.innerHTML = ''; return }

            // Handle Page BGM
            if (page.bgm) VP.am.playBGM(page.bgm);
            else VP.am.stopBGM();

            let html = `<div class="reader-page" style="background:${page.background || '#fff'}">`;
            if (page.texture) html += `<div style="position:absolute;inset:0;background-image:url('${page.texture}');background-size:cover;opacity:.2;pointer-events:none"></div>`;
            (page.elements || []).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach(el => {
                html += VP.ed.elementToHTML(el, false);
            });
            html += '</div>';
            book.innerHTML = html;
            document.getElementById('readerPageNum').textContent = (this.pageIdx + 1) + ' / ' + this.data.pages.length;

            // Initialize Shaders in Reader
            requestAnimationFrame(() => {
                book.querySelectorAll('.vp-shader-canvas').forEach(c => {
                    if (window.VPShader) {
                        const code = decodeURIComponent(escape(atob(c.dataset.code)));
                        VPShader.start(c, 'custom', code);
                    }
                });
            });
        },
        next() {
            if (!this.data) return;
            let nextIdx = this.pageIdx + 1;
            while (nextIdx < this.data.pages.length) {
                const p = this.data.pages[nextIdx];
                if (!p.isLocked || this.unlockedPages.has(nextIdx)) {
                    this.pageIdx = nextIdx;
                    this.renderPage();
                    return;
                }
                nextIdx++;
            }
        },
        prev() {
            let prevIdx = this.pageIdx - 1;
            while (prevIdx >= 0) {
                const p = this.data.pages[prevIdx];
                if (!p.isLocked || this.unlockedPages.has(prevIdx)) {
                    this.pageIdx = prevIdx;
                    this.renderPage();
                    return;
                }
                prevIdx--;
            }
        }
    },

    handleInteraction(el, e) {
        e.stopPropagation();
        const action = el.dataset.action;
        const val = el.dataset.actionVal;
        if (action === 'goto') {
            const idx = parseInt(val) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < this.reader.data.pages.length) {
                this.reader.pageIdx = idx;
                this.reader.renderPage();
            }
        } else if (action === 'unlock') {
            const idx = parseInt(val) - 1;
            if (!isNaN(idx)) {
                this.reader.unlockedPages.add(idx);
                this.toast('Path unlocked!', 'success');
            }
        } else if (action === 'password') {
            const idx = parseInt(val) - 1;
            if (!isNaN(idx)) {
                this._pendingPassPage = idx;
                this.showModal('passwordModal');
                setTimeout(() => document.getElementById('passInput').focus(), 100);
            }
        } else if (action === 'toggle') {
            const book = document.getElementById('readerBook');
            const target = Array.from(book.querySelectorAll('.reader-el-item')).find(x => x.dataset.label === val);
            if (target) {
                target.style.display = (target.style.display === 'none') ? 'block' : 'none';
                // Trigger shader resize if it's a shader
                if (target.querySelector('canvas')) {
                    requestAnimationFrame(() => {
                        const c = target.querySelector('canvas');
                        if (c && window.VPShader) VPShader.resize(c);
                    });
                }
            }
        } else if (action === 'vfx') {
            this.doVFX(val);
        } else if (action === 'sfx') {
            this.am.playSFX(val);
        } else if (action === 'link') {
            window.open(val, '_blank');
        }
    },

    doVFX(type) {
        const b = document.getElementById('readerBook');
        if (type === 'flash') {
            const f = document.createElement('div'); f.style.cssText = "position:absolute;inset:0;background:#fff;z-index:9999;pointer-events:none";
            b.appendChild(f);
            f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' }).onfinish = () => f.remove();
        } else if (type === 'lightning') {
            const f = document.createElement('div'); f.style.cssText = "position:absolute;inset:0;background:#fff;z-index:9999;pointer-events:none";
            b.appendChild(f);
            f.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0 }], { duration: 400 }).onfinish = () => f.remove();
        } else if (type === 'shake') {
            b.animate([{ transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(0)' }], { duration: 300 });
        } else if (type === 'pulse') {
            b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }], { duration: 400 });
        }
    },

    handlePassSubmit() {
        const input = document.getElementById('passInput');
        const pass = input.value;
        const targetIdx = this._pendingPassPage;
        const page = this.reader.data.pages[targetIdx];

        if (page && page.password === pass) {
            this.reader.unlockedPages.add(targetIdx);
            this.closeModal('passwordModal');
            this.reader.pageIdx = targetIdx;
            this.reader.renderPage();
            this.toast('Success! Path opened.', 'success');
            input.value = '';
        } else {
            this.toast('Incorrect password', 'error');
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 400);
        }
    },

    // ── INIT ──
    init() {
        if (this.projects.length === 0) {
            this.projects.push(window.getTutorialData());
            this.saveLocal();
        }
        this.renderDashboard();
        this.ed.init();

        // PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(reg => console.log('SW registered')).catch(err => console.log('SW failed', err));
        }
        window.addEventListener('online', () => { this.isOnline = true; this.updateCloudIcon('online'); this.sync(); });
        window.addEventListener('offline', () => { this.isOnline = false; this.updateCloudIcon('offline'); });
        this.updateCloudIcon(this.isOnline ? 'online' : 'offline');

        // Sync Cycle
        setInterval(() => this.sync(), 60000); // 1 min sync
        setTimeout(() => this.sync(), 2000); // Initial sync

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
