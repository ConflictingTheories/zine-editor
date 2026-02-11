// Adapted from old version's editor.js export methods

// Lightweight WebGL runner to replace external mushu-flow dependency for exports
const MINI_MUSHU = `
(function(){
    window.mushu = function(c) {
        return {
            gl: function(fc) {
                var gl = c.getContext('webgl');
                if(!gl) return;
                var p = gl.createProgram();
                var vs = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vs, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}');
                gl.compileShader(vs);
                var fs = gl.createShader(gl.FRAGMENT_SHADER);
                var src = 'precision mediump float;uniform float time;uniform vec2 resolution;' + fc;
                gl.shaderSource(fs, src);
                gl.compileShader(fs);
                if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(fs)); return; }
                gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); gl.useProgram(p);
                var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
                var loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
                var tLoc = gl.getUniformLocation(p, 'time');
                var rLoc = gl.getUniformLocation(p, 'resolution');
                var st = Date.now();
                function loop() {
                    if(!gl.canvas.offsetParent) return; 
                    gl.viewport(0,0,c.width,c.height);
                    gl.uniform1f(tLoc, (Date.now()-st)/1000);
                    gl.uniform2f(rLoc, c.width, c.height);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    requestAnimationFrame(loop);
                }
                loop();
            }
        };
    };
})();`;

export const exportToHTML = (project, embedAssets = false) => {
    const ld = document.createElement('div');
    ld.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#fff";
    ld.innerHTML = '<div>Loading...</div>';
    document.body.appendChild(ld);

    setTimeout(() => {
        let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Void Press Zine</title>
        <style>
            body{margin:0;padding:20px;background:#111;font-family:Arial,sans-serif}
            .page-wrap{max-width:528px;margin:0 auto;display:none}.page-wrap.active{display:block}
            .page{position:relative;width:100%;aspect-ratio:5.5/8.5;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.5);margin-bottom:20px;overflow:hidden}.el{position:absolute}
            .nav{text-align:center;padding:20px}.btn{padding:10px 24px;background:#d4af37;color:#000;border:none;cursor:pointer;font-weight:600;margin:0 8px;border-radius:6px}
            #vp-overlay{position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.5s}
            #vp-mute{position:fixed;top:20px;right:20px;z-index:10000;background:rgba(0,0,0,0.8);border:1px solid #d4af37;color:#d4af37;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;font-family:sans-serif}
            #vp-mute:hover{background:#d4af37;color:#000}
            .start-btn{padding:15px 40px;font-size:20px;background:#d4af37;color:#000;border:none;cursor:pointer;border-radius:30px;font-weight:bold;margin-top:20px;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px}
            .start-btn:hover{transform:scale(1.05)}
            #pg{color:#aaa;margin:0 16px}
            .modal{position:fixed;inset:0;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center;z-index:1000}
            .modal.active{display:flex}
            .modal-content{background:#1a1a1f;padding:30px;border:1px solid #d4af37;border-radius:8px;color:#fff;max-width:300px;text-align:center}
            input{width:100%;padding:10px;margin:15px 0;background:#000;border:1px solid #444;color:#fff;border-radius:4px}
            .shake{animation:shake 0.4s} @keyframes shake{0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)}}
            .btn-audio{width:32px;height:32px;border-radius:50%;border:1px solid #d4af37;background:transparent;color:#d4af37;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s}
            .btn-audio:hover{background:#d4af37;color:#000}
        </style></head><body>`;

        html += `<div id="vp-overlay"><h1 style="color:#d4af37;font-size:3rem;margin-bottom:1rem;font-family:sans-serif">VOID PRESS</h1><button class="start-btn" onclick="startZine()">ENTER ZINE</button></div>`;
        html += `<button id="vp-mute" onclick="toggleMute()">ON</button>`;

        project.pages.forEach((p, i) => {
            html += `<div class="page-wrap${i === 0 ? ' active' : ''}" id="p${i}" data-bgm="${p.bgm || ''}" data-locked="${p.isLocked ? '1' : ''}" data-pass="${p.password || ''}" style="background:${p.background}">`;
            if (p.texture) html += `<div style="position:absolute;inset:0;background-image:url('${p.texture}');background-size:cover;opacity:.2"></div>`;
            p.elements.filter(e => !e.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach(e => { html += elementToHTML(e) });
            html += `</div></div>`;
        });

        const sc = `
        let c=0,t=${project.pages.length},au=null,up=new Set(),pp=-1,genCtx,genNodes=[],muted=false,curMood=null;
        const Gen = {
            init: () => { if(!genCtx) genCtx = new (window.AudioContext||window.webkitAudioContext)(); },
            stop: () => { genNodes.forEach(n => { try{n.stop();n.disconnect();}catch(e){} }); genNodes=[]; },
            play: (mood) => {
                curMood = mood; if(muted) return;
                Gen.init(); Gen.stop(); if(genCtx && genCtx.state==='suspended')genCtx.resume();
                const mkOsc=(type,freq,gVal)=>{ const o=genCtx.createOscillator();const g=genCtx.createGain();o.type=type;o.frequency.value=freq;o.connect(g);g.connect(genCtx.destination);o.start();g.gain.value=gVal;return [o,g]; };
                if(mood==='drone'){
                    genNodes.push(...mkOsc('sine',55,0.1)); const [o2,g2]=mkOsc('sine',57,0.1); genNodes.push(o2,g2);
                } else if(mood==='horror'){
                    const [o,g]=mkOsc('sawtooth',40,0.1); const f=genCtx.createBiquadFilter();f.type='lowpass';f.frequency.value=200;
                    o.disconnect();o.connect(f);f.connect(g); genNodes.push(o,f,g);
                } else if(mood==='cyber'){
                    const [o,g]=mkOsc('square',110,0.05);
                    const iv=setInterval(()=>{if(genNodes.length===0)clearInterval(iv);else o.frequency.value=[110,130,165,196][Math.floor(Math.random()*4)];},200);
                    genNodes.push(o,g);
                } else if(mood==='nature'){
                    const b=genCtx.createBufferSource(),bs=genCtx.createBuffer(1,genCtx.sampleRate*2,genCtx.sampleRate);
                    const d=bs.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
                    b.buffer=bs;b.loop=true;const g=genCtx.createGain();g.gain.value=0.05;const f=genCtx.createBiquadFilter();f.type='lowpass';f.frequency.value=400;
                    b.connect(f);f.connect(g);g.connect(genCtx.destination);b.start(); genNodes.push(b,f,g);
                }
            }
        };
        window.toggleMute = () => {
            muted = !muted;
            const btn = document.getElementById('vp-mute');
            btn.innerHTML = muted ? 'OFF' : 'ON';
            btn.style.borderColor = muted ? '#666' : '#d4af37';
            btn.style.color = muted ? '#666' : '#d4af37';
            if(muted) { Gen.stop(); if(au) au.pause(); }
            else { if(curMood) Gen.play(curMood); if(au) au.play(); }
        };
        window.startZine = () => {
            const ov = document.getElementById('vp-overlay'); ov.style.opacity = 0;
            setTimeout(() => { ov.remove(); Gen.init(); show(0); }, 500);
        };
        let curLog=null, vizCtx=null, vizRaf=null;
        window.playAudioLog = (btn) => {
            const src=btn.dataset.src; const cvs=btn.closest('.audio-log-wrap').querySelector('canvas'); const ctx=cvs.getContext('2d');
            if(btn.dataset.playing==='1'){ if(curLog){curLog.pause();curLog=null;} btn.dataset.playing='0'; btn.innerHTML='▶'; cancelAnimationFrame(vizRaf); ctx.clearRect(0,0,cvs.width,cvs.height); return; }
            document.querySelectorAll('.btn-audio').forEach(b=>{b.dataset.playing='0';b.innerHTML='▶';});
            if(curLog)curLog.pause();
            btn.dataset.playing='1'; btn.innerHTML='■';
            const aud=new Audio(src); aud.crossOrigin='anonymous'; curLog=aud;
            if(!vizCtx) vizCtx=new (window.AudioContext||window.webkitAudioContext)();
            let anl=null;
            try { if(!btn.sourceNode) { const srcNode = vizCtx.createMediaElementSource(aud); anl = vizCtx.createAnalyser(); anl.fftSize=256; srcNode.connect(anl); anl.connect(vizCtx.destination); } } catch(e){ console.warn(e); aud.connect(vizCtx.destination); }
            aud.play().catch(e=>console.warn(e));
            aud.onended=()=>{btn.dataset.playing='0';btn.innerHTML='▶';cancelAnimationFrame(vizRaf);ctx.clearRect(0,0,cvs.width,cvs.height);};
            const draw=()=>{
                if(btn.dataset.playing!=='1')return; vizRaf=requestAnimationFrame(draw); ctx.clearRect(0,0,cvs.width,cvs.height);
                if(anl){ const len=anl.frequencyBinCount; const data=new Uint8Array(len); anl.getByteFrequencyData(data); const w=cvs.width/len; const theme=cvs.dataset.theme;
                    if(theme==='circle'){ const cx=cvs.width/2, cy=cvs.height/2, r=Math.min(cx,cy)-10; ctx.beginPath(); for(let i=0;i<len;i++){ const v=data[i]/255; const ang=(i/len)*Math.PI*2; const x=cx+Math.cos(ang)*(r*0.5 + v*r*0.5); const y=cy+Math.sin(ang)*(r*0.5 + v*r*0.5); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); } ctx.closePath(); ctx.strokeStyle='#d4af37'; ctx.stroke(); } else { for(let i=0;i<len;i++){ const h=(data[i]/255)*cvs.height; ctx.fillStyle='#d4af37'; ctx.fillRect(i*w,cvs.height-h,w,h); } } }
            }; if(anl) draw();
        };
        function H(el,e){
            e.stopPropagation(); const a=el.dataset.action,v=el.dataset.actionVal;
            if(a==='goto'){ show(parseInt(v)-1); }
            else if(a==='unlock'){ up.add(parseInt(v)-1); alert('Path Unlocked!'); }
            else if(a==='password'){ pp=parseInt(v)-1; document.getElementById('pw').classList.add('active'); document.getElementById('pi').focus(); }
            else if(a==='toggle'){
                const target = Array.from(document.querySelectorAll('.reader-el-item')).find(x => x.dataset.label === v);
                if(target) target.style.display = (target.style.display==='none') ? 'block' : 'none';
            }
            else if(a==='vfx'){
                const b=document.body;
                if(v==='flash'){
                    const f=document.createElement('div'); f.style.cssText="position:fixed;inset:0;background:#fff;z-index:9999;pointer-events:none";
                    b.appendChild(f); f.animate([{opacity:1},{opacity:0}],{duration:500,easing:'ease-out'}).onfinish=()=>f.remove();
                } else if(v==='lightning'){
                    const f=document.createElement('div'); f.style.cssText="position:fixed;inset:0;background:#fff;z-index:9999;pointer-events:none";
                    b.appendChild(f); f.animate([{opacity:0},{opacity:1},{opacity:0.2},{opacity:1},{opacity:0}],{duration:400}).onfinish=()=>f.remove();
                } else if(v==='shake'){
                    document.querySelector('.page-wrap.active').animate([{transform:'translateX(-10px)'},{transform:'translateX(10px)'},{transform:'translateX(-10px)'},{transform:'translateX(0)'}],{duration:300});
                } else if(v==='pulse'){
                    document.querySelector('.page-wrap.active').animate([{transform:'scale(1)'},{transform:'scale(1.02)'},{transform:'scale(1)'}],{duration:400});
                }
            }
            else if(a==='sfx'){ new Audio(v).play(); }
            else if(a==='link'){ window.open(v,'_blank'); }
        }
        function PWS(){
            const i=document.getElementById('pi'), p=document.getElementById('p'+pp);
            if(p && p.dataset.pass === i.value){
                up.add(pp); document.getElementById('pw').classList.remove('active'); show(pp); i.value='';
            } else { i.classList.add('shake'); setTimeout(()=>i.classList.remove('shake'),400); }
        }
        function P(url){
            if(au&&au.src===url)return; if(au){au.pause();au=null;} Gen.stop();
            if(!url || muted)return;
            if(url.startsWith('gen:')){ Gen.play(url.split(':')[1]); } else { au=new Audio(url); au.loop=true; au.play().catch(e=>console.warn(e)); }
        }
        function show(n){
            if(n<0||n>=t)return; c=n;
            for(let i=0;i<t;i++){ const e=document.getElementById('p'+i); e.className='page-wrap'+(i===n?' active':''); }
            document.getElementById('pg').textContent=(n+1)+'/'+t;
            P(document.getElementById('p'+n).dataset.bgm);
        }
        function next(){
            let n=c+1; while(n<t){
                const p=document.getElementById('p'+n);
                if(!p.dataset.locked || up.has(n)){ show(n); return; }
                n++;
            }
        }
        function prev(){
            let n=c-1; while(n>=0){
                const p=document.getElementById('p'+n);
                if(!p.dataset.locked || up.has(n)){ show(n); return; }
                n--;
            }
        }
        /* window.onload handled by startZine */`;

        const msc = `
        document.querySelectorAll('.vp-shader-canvas').forEach(c => {
            try {
                const code = decodeURIComponent(escape(atob(c.dataset.code)));
                window.mushu(c).gl(code);
            } catch(e) { console.warn(e); }
        });`;

        html += `<div class="nav"><button class="btn" onclick="prev()">◀ Prev</button><span id="pg">1/${project.pages.length}</span><button class="btn" onclick="next()">Next ▶</button></div>`;
        html += `<div class="modal" id="pw"><div class="modal-content"><h3>🔒 Locked</h3><p>Enter password to unlock path</p><input type="password" id="pi"><div style="display:flex;gap:10px"><button class="btn" onclick="PWS()" style="flex:1">Unlock</button><button class="btn" onclick="document.getElementById('pw').classList.remove('active')" style="flex:1;background:#333;color:#fff">Cancel</button></div></div></div>`;
        html += `<script>${MINI_MUSHU}</script><script>${sc}</script><script>${msc}</script></body></html>`;

        const blob = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'voidpress-zine.html'; a.click();
        ld.remove();
    }, 300);
}

export const exportToInteractive = async (project, embedAssets = false) => {
    const ld = document.createElement('div');
    ld.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#fff";
    ld.innerHTML = '<div>Building Interactive Zine...</div>';
    document.body.appendChild(ld);

    // Fetch PageFlip if embedding is requested
    let pageFlipScript = `<script src="https://unpkg.com/page-flip@2.0.7/dist/js/page-flip.browser.js"></script>`;
    if (embedAssets) {
        try {
            ld.innerHTML = '<div>Fetching libraries...</div>';
            const res = await fetch('https://unpkg.com/page-flip@2.0.7/dist/js/page-flip.browser.js');
            if (res.ok) {
                const text = await res.text();
                pageFlipScript = `<script>${text}</script>`;
            }
        } catch (e) {
            console.warn('Failed to fetch page-flip for embedding, falling back to CDN');
        }
    }

    setTimeout(() => {
        let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Void Press Zine</title>
        ${pageFlipScript}
        <style>
            body{margin:0;padding:0;background:#111;font-family:Arial,sans-serif;overflow:hidden;height:100vh}
            .book-stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
            .page{background-color:#fff;overflow:hidden;position:relative;display:none;box-shadow:inset 0 0 20px rgba(0,0,0,0.1)} 
            .page.-active{display:block}
            .el{position:absolute}
            #vp-overlay{position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.5s}
            #vp-mute{position:fixed;top:20px;right:20px;z-index:10000;background:rgba(0,0,0,0.8);border:1px solid #d4af37;color:#d4af37;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;font-family:sans-serif}
            #vp-mute:hover{background:#d4af37;color:#000}
            .start-btn{padding:15px 40px;font-size:20px;background:#d4af37;color:#000;border:none;cursor:pointer;border-radius:30px;font-weight:bold;margin-top:20px;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px}
            .start-btn:hover{transform:scale(1.05)}
            .btn-audio{width:32px;height:32px;border-radius:50%;border:1px solid #d4af37;background:transparent;color:#d4af37;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s}
            .btn-audio:hover{background:#d4af37;color:#000}
        </style></head><body>`;

        html += `<div id="vp-overlay"><h1 style="color:#d4af37;font-size:3rem;margin-bottom:1rem;font-family:sans-serif">VOID PRESS</h1><button class="start-btn" onclick="startZine()">ENTER ZINE</button></div>`;
        html += `<button id="vp-mute" onclick="toggleMute()">ON</button>`;

        html += `<div class="book-stage"><div id="book">`;
        project.pages.forEach((p, i) => {
            html += `<div class="page" id="p${i}" data-bgm="${p.bgm || ''}" style="background:${p.background}">`;
            if (p.texture) html += `<div style="position:absolute;inset:0;background-image:url('${p.texture}');background-size:cover;opacity:.2"></div>`;
            p.elements.filter(e => !e.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach(e => { html += elementToHTML(e) });
            html += `<div style="position:absolute;bottom:10px;width:100%;text-align:center;color:#aaa;font-size:12px;pointer-events:none">${i + 1}</div>`;
            html += `</div>`;
        });
        html += `</div></div>`;

        const sc = `
        let au=null, genCtx, genNodes=[], muted=false, curMood=null, pf=null;
        const Gen = {
            init: () => { if(!genCtx) genCtx = new (window.AudioContext||window.webkitAudioContext)(); },
            stop: () => { genNodes.forEach(n => { try{n.stop();n.disconnect();}catch(e){} }); genNodes=[]; },
            play: (mood) => {
                curMood = mood; if(muted) return;
                Gen.init(); Gen.stop(); if(genCtx && genCtx.state==='suspended')genCtx.resume();
                const mkOsc=(type,freq,gVal)=>{ const o=genCtx.createOscillator();const g=genCtx.createGain();o.type=type;o.frequency.value=freq;o.connect(g);g.connect(genCtx.destination);o.start();g.gain.value=gVal;return [o,g]; };
                if(mood==='drone'){ genNodes.push(...mkOsc('sine',55,0.1)); const [o2,g2]=mkOsc('sine',57,0.1); genNodes.push(o2,g2); }
                else if(mood==='horror'){ const [o,g]=mkOsc('sawtooth',40,0.1); const f=genCtx.createBiquadFilter();f.type='lowpass';f.frequency.value=200; o.disconnect();o.connect(f);f.connect(g); genNodes.push(o,f,g); }
                else if(mood==='cyber'){ const [o,g]=mkOsc('square',110,0.05); const iv=setInterval(()=>{if(genNodes.length===0)clearInterval(iv);else o.frequency.value=[110,130,165,196][Math.floor(Math.random()*4)];},200); genNodes.push(o,g); }
                else if(mood==='nature'){ const b=genCtx.createBufferSource(),bs=genCtx.createBuffer(1,genCtx.sampleRate*2,genCtx.sampleRate); const d=bs.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1; b.buffer=bs;b.loop=true;const g=genCtx.createGain();g.gain.value=0.05;const f=genCtx.createBiquadFilter();f.type='lowpass';f.frequency.value=400; b.connect(f);f.connect(g);g.connect(genCtx.destination);b.start(); genNodes.push(b,f,g); }
            }
        };
        window.toggleMute = () => {
            muted = !muted; const btn = document.getElementById('vp-mute');
            btn.innerHTML = muted ? 'OFF' : 'ON'; btn.style.borderColor = muted ? '#666' : '#d4af37'; btn.style.color = muted ? '#666' : '#d4af37';
            if(muted) { Gen.stop(); if(au) au.pause(); } else { if(curMood) Gen.play(curMood); if(au) au.play(); }
        };
        window.startZine = () => {
            const ov = document.getElementById('vp-overlay'); ov.style.opacity = 0;
            setTimeout(() => { ov.remove(); Gen.init();
                const el = document.getElementById('book');
                pf = new St.PageFlip(el, { width: 528, height: 816, size: 'fixed', minWidth: 300, maxWidth: 1000, minHeight: 400, maxHeight: 1400, maxShadowOpacity: 0.5, showCover: true, mobileScrollSupport: false });
                pf.loadFromHTML(document.querySelectorAll('.page'));
                pf.on('flip', (e) => { const p = document.querySelectorAll('.page')[e.data]; if(p) P(p.dataset.bgm); });
                const p0 = document.querySelectorAll('.page')[0]; if(p0) P(p0.dataset.bgm);
            }, 500);
        };
        function H(el,e){
            e.stopPropagation(); const a=el.dataset.action,v=el.dataset.actionVal;
            if(a==='goto'){ if(pf) pf.flip(parseInt(v)-1); }
            else if(a==='unlock'){ alert('Path Unlocked!'); }
            else if(a==='toggle'){ const target = Array.from(document.querySelectorAll('.reader-el-item')).find(x => x.dataset.label === v); if(target) target.style.display = (target.style.display==='none') ? 'block' : 'none'; }
            else if(a==='sfx'){ new Audio(v).play(); }
            else if(a==='link'){ window.open(v,'_blank'); }
        }
        function P(url){
            if(au&&au.src===url)return; if(au){au.pause();au=null;} Gen.stop(); if(!url || muted)return;
            if(url.startsWith('gen:')){ Gen.play(url.split(':')[1]); } else { au=new Audio(url); au.loop=true; au.play().catch(e=>console.warn(e)); }
        }
        let curLog=null, vizCtx=null, vizRaf=null;
        window.playAudioLog = (btn) => {
            const src=btn.dataset.src; const cvs=btn.closest('.audio-log-wrap').querySelector('canvas'); const ctx=cvs.getContext('2d');
            if(btn.dataset.playing==='1'){ if(curLog){curLog.pause();curLog=null;} btn.dataset.playing='0'; btn.innerHTML='▶'; cancelAnimationFrame(vizRaf); ctx.clearRect(0,0,cvs.width,cvs.height); return; }
            document.querySelectorAll('.btn-audio').forEach(b=>{b.dataset.playing='0';b.innerHTML='▶';});
            if(curLog)curLog.pause(); btn.dataset.playing='1'; btn.innerHTML='■';
            const aud=new Audio(src); aud.crossOrigin='anonymous'; curLog=aud;
            if(!vizCtx) vizCtx=new (window.AudioContext||window.webkitAudioContext)(); let anl=null;
            try { if(!btn.sourceNode) { const srcNode = vizCtx.createMediaElementSource(aud); anl = vizCtx.createAnalyser(); anl.fftSize=256; srcNode.connect(anl); anl.connect(vizCtx.destination); } } catch(e){ console.warn(e); aud.connect(vizCtx.destination); }
            aud.play().catch(e=>console.warn(e)); aud.onended=()=>{btn.dataset.playing='0';btn.innerHTML='▶';cancelAnimationFrame(vizRaf);ctx.clearRect(0,0,cvs.width,cvs.height);};
            const draw=()=>{ if(btn.dataset.playing!=='1')return; vizRaf=requestAnimationFrame(draw); ctx.clearRect(0,0,cvs.width,cvs.height); if(anl){ const len=anl.frequencyBinCount; const data=new Uint8Array(len); anl.getByteFrequencyData(data); const w=cvs.width/len; for(let i=0;i<len;i++){ const h=(data[i]/255)*cvs.height; ctx.fillStyle='#d4af37'; ctx.fillRect(i*w,cvs.height-h,w,h); } } }; if(anl) draw();
        };`;

        const msc = `document.querySelectorAll('.vp-shader-canvas').forEach(c => { try { const code = decodeURIComponent(escape(atob(c.dataset.code))); window.mushu(c).gl(code); } catch(e) { console.warn(e); } });`;
        html += `<script>${MINI_MUSHU}</script><script>${sc}</script><script>${msc}</script></body></html>`;
        const blob = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'voidpress-interactive.html'; a.click();
        ld.remove();
    }, 300);
}

export const exportToPDF = async (project, embedAssets = false) => {
    const ld = document.createElement('div');
    ld.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#fff";
    ld.innerHTML = '<div>Initializing PDF Export...</div>';
    document.body.appendChild(ld);

    try {
        // Dynamic load of dependencies if missing
        const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector('script[src="' + src + '"]')) return resolve();
            const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
        });

        if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

        let mushu;
        try {
            const m = await import('https://unpkg.com/mushu-flow@1.1.0/src/index.js');
            mushu = m.mushu;
        } catch (e) { console.warn('Failed to load mushu for PDF export', e); }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [550, 850] });

        const container = document.createElement('div');
        container.style.cssText = "position:absolute;left:-9999px;top:0;width:550px;height:850px;overflow:hidden;background:#fff";
        document.body.appendChild(container);

        try {
            for (let i = 0; i < project.pages.length; i++) {
                const p = project.pages[i];
                ld.innerHTML = `<div>Generating PDF... Page ${i + 1}/${project.pages.length}</div>`;

                if (mushu) {
                    for (const el of p.elements) {
                        if (el.type === 'shader' && el.shaderCode) {
                            try {
                                const c = document.createElement('canvas');
                                c.width = el.width; c.height = el.height;
                                mushu(c).gl(el.shaderCode);
                                await new Promise(r => setTimeout(r, 50));
                                el.shaderImage = c.toDataURL('image/jpeg', 0.9);
                            } catch (e) { console.warn('Shader render failed', e); }
                        }
                    }
                }

                container.innerHTML = `<div style="width:100%;height:100%;position:relative;background:${p.background}">
                    ${p.texture ? `<div style="position:absolute;inset:0;background-image:url('${p.texture}');background-size:cover;opacity:.2"></div>` : ''}
                    ${p.elements.filter(e => !e.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(e => elementToHTML(e, false)).join('')}
                </div>`;

                // Allow DOM to settle and images to load
                await new Promise(r => setTimeout(r, 150));

                const canvas = await window.html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    imageTimeout: 5000
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);

                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, 550, 850);

                p.elements.forEach(e => { if (e.shaderImage) delete e.shaderImage; });
            }
            pdf.save('voidpress-zine.pdf');
        } finally {
            container.remove();
        }
    } catch (e) {
        console.error(e);
        alert('PDF export failed: ' + e.message);
    }
    ld.remove();
}

// Helper function from old version
const elementToHTML = (el, isExport = true) => {
    let s = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;transform:rotate(${el.rotation || 0}deg);z-index:${el.zIndex || 0};opacity:${el.opacity ?? 1};mix-blend-mode:${el.blendMode || 'normal'};`;
    if (el.isHidden) s += 'display:none;';
    let content = '';
    const handler = isExport ? 'H' : 'VP.handleInteraction';
    if (el.type === 'text' || el.type === 'balloon') {
        s += `font-size:${el.fontSize}px;font-family:${el.fontFamily || 'sans-serif'};color:${el.color || '#000'};text-align:${el.align || 'left'};`;
        if (el.bold) s += 'font-weight:bold;'; if (el.italic) s += 'font-style:italic;';
        content = el.content || '';
        if (el.type === 'balloon') {
            if (el.balloonType === 'dialog') { s += 'background:#fff;border:2px solid #000;border-radius:20px;padding:10px;' }
            if (el.balloonType === 'thought') { s += 'background:#fff;border:2px solid #000;border-radius:50%;padding:10px;' }
            if (el.balloonType === 'shout') { s += 'background:#fff;border:4px solid #000;padding:10px;font-weight:bold;' }
            if (el.balloonType === 'caption') { s += 'background:#000;color:#fff;padding:10px;' }
            if (el.balloonType === 'whisper') { s += 'background:#f8f8f8;border:1px dashed #999;border-radius:16px;padding:10px;font-style:italic;' }
            if (el.balloonType === 'narration') { s += 'background:#ffe;border:1px solid #cc9;padding:10px;font-style:italic;' }
        }
    }
    if (el.type === 'image') content = `<img src="${el.src}" style="width:100%;height:100%;object-fit:${el.objectFit || 'cover'}">`;
    if (el.type === 'video') content = `<video src="${el.src}" controls style="width:100%;height:100%;object-fit:${el.objectFit || 'cover'}"></video>`;
    if (el.type === 'audio-log') {
        content = `<div class="audio-log-wrap" style="display:flex;flex-direction:column;width:100%;height:100%;background:rgba(0,0,0,0.5);border:1px solid #d4af37;padding:10px;box-sizing:border-box;color:#fff">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <button class="btn-audio" data-src="${el.src}" onclick="playAudioLog(this)">▶</button>
                <div style="font-weight:bold">${el.label || 'AUDIO LOG'}</div>
            </div>
            <canvas width="${el.width}" height="${el.height - 50}" style="flex:1;width:100%;background:#000;border-radius:4px" data-theme="${el.vizTheme || 'bars'}"></canvas>
        </div>`;
    }
    if (el.type === 'panel') s += `border:${el.panelBorderWidth || 0}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'};background:${el.fill || 'transparent'};border-radius:${el.panelRadius || 0}px;`;
    if (el.type === 'shape') { s += `background:${el.fill || '#000'};`; if (el.shape === 'circle') s += 'border-radius:50%;' }
    if (el.type === 'shader') {
        if (el.shaderImage) {
            content = `<img src="${el.shaderImage}" style="width:100%;height:100%;object-fit:cover">`;
        } else {
            content = `<canvas class="vp-shader-canvas" data-code="${btoa(unescape(encodeURIComponent(el.shaderCode || '')))}" style="width:100%;height:100%"></canvas>`;
        }
    }
    if (el.shadow) s += `box-shadow:${el.shadow};`;
    if (el.animation && el.animation !== 'none') s += `animation:${el.animation} ${el.animDuration || 1}s ease ${el.animLoop ? 'infinite' : 'both'};`;

    let attr = `style="${s}" class="reader-el-item" data-label="${el.label || ''}"`;
    if (el.action) {
        attr = `style="${s}cursor:pointer" class="reader-el-item" data-label="${el.label || ''}" data-action="${el.action}" data-action-val="${el.actionVal || ''}" onclick="${handler}(this, event)"`;
    }
    return `<div ${attr}>${content}</div>`;
}
