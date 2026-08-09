// Adapted from old version's editor.js export methods
import MCPClient from './mcpClient.js'
import { PAGE_W, PAGE_H } from '../constants.js'

// Server-side export using MCP (for automation)
export const exportToHTMLServer = async (project, token) => {
    const mcp = new MCPClient()
    try {
        const result = await mcp.exportHTML(project, token)
        return result.html
    } catch (error) {
        console.error('Server HTML export failed:', error)
        throw error
    }
}

export const exportToPDFServer = async (project, token) => {
    const mcp = new MCPClient()
    try {
        const result = await mcp.exportPDF(project, token)
        return result
    } catch (error) {
        console.error('Server PDF export failed:', error)
        throw error
    }
}

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
                    // Only draw if visible, but keep loop alive for navigation
                    if(gl.canvas.offsetParent) {
                        gl.viewport(0,0,c.width,c.height);
                        gl.uniform1f(tLoc, (Date.now()-st)/1000);
                        gl.uniform2f(rLoc, c.width, c.height);
                        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    }
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
        let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>SVRN Publishing Zine</title>
        <link rel="stylesheet" href="/fonts/fonts.css">
        <style>
            body{margin:0;padding:0;background:#121212;color:#e0e0e0;font-family:var(--font-ui, 'Helvetica Neue',Helvetica,Arial,sans-serif);height:100vh;display:flex;flex-direction:column;overflow:hidden}
            .reader-header{padding:15px 20px;background:#1a1a1a;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;z-index:10}
            .reader-title{font-weight:700;letter-spacing:1px;color:#d4af37;font-size:1.1em}
            .reader-main{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:radial-gradient(circle at center,#2a2a2a 0%,#121212 100%)}
            .page-wrap{width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;box-shadow:0 0 50px rgba(0,0,0,0.6);position:absolute;top:50%;left:50%;margin-top:-${PAGE_H / 2}px;margin-left:-${PAGE_W / 2}px;display:none;transform-origin:center;overflow:hidden}
            .page-wrap.active{display:block;animation:fadeIn 0.4s cubic-bezier(0.25, 1, 0.5, 1)}
            @keyframes fadeIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
            .reader-controls{padding:20px;background:#1a1a1a;border-top:1px solid #333;display:flex;justify-content:center;gap:20px;align-items:center;z-index:10}
            .btn{background:transparent;border:1px solid #444;color:#aaa;padding:8px 20px;border-radius:4px;cursor:pointer;transition:all 0.2s;font-size:0.9em;text-transform:uppercase;letter-spacing:0.5px}
            .btn:hover{border-color:#d4af37;color:#d4af37;background:rgba(212,175,55,0.05)}
            .btn:active{transform:translateY(1px)}
            #pg{color:#666;font-variant-numeric:tabular-nums;font-size:0.9em;min-width:60px;text-align:center}
            
            #vp-overlay{position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.5s}
            .start-btn{padding:15px 40px;font-size:18px;background:transparent;color:#d4af37;border:2px solid #d4af37;cursor:pointer;border-radius:4px;font-weight:bold;margin-top:30px;font-family:var(--font-ui, sans-serif);text-transform:uppercase;letter-spacing:2px;transition:all 0.3s}
            .start-btn:hover{transform:scale(1.05)}
            
            .mute-btn{width:32px;height:32px;border:1px solid #444;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#666;transition:all 0.2s}
            .mute-btn:hover{border-color:#d4af37;color:#d4af37}
            .mute-btn.active{background:#d4af37;color:#000;border-color:#d4af37}

            .modal{position:fixed;inset:0;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center;z-index:1000}
            .modal.active{display:flex}
            .modal-content{background:#1a1a1f;padding:30px;border:1px solid #d4af37;border-radius:8px;color:#fff;max-width:300px;text-align:center}
            input{width:100%;padding:10px;margin:15px 0;background:#000;border:1px solid #444;color:#fff;border-radius:4px}
            .shake{animation:shake 0.4s} @keyframes shake{0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)}}
            .btn-audio{width:32px;height:32px;border-radius:50%;border:1px solid #d4af37;background:transparent;color:#d4af37;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s}
            .btn-audio:hover{background:#d4af37;color:#000}
        </style></head><body>`;

        html += `<div id="vp-overlay"><h1 style="color:#fff;font-size:3rem;margin-bottom:0.5rem;font-family:var(--font-ui, sans-serif);letter-spacing:4px">SVRN PUBLISHING</h1><div style="color:#666;letter-spacing:2px;font-size:0.9rem">SOVEREIGN INTERACTIVE ZINE READER</div><button class="start-btn" onclick="startZine()">ENTER REALITY</button></div>`;

        html += `<div class="reader-header">
            <div class="reader-title">${project.title || 'UNTITLED ZINE'}</div>
            <button id="vp-mute" class="mute-btn" onclick="toggleMute()" title="Toggle Audio">♪</button>
        </div>`;

        html += `<div class="reader-main">`;

        project.pages.forEach((p, i) => {
            html += `<div class="page-wrap${i === 0 ? ' active' : ''}" id="p${i}" data-bgm="${p.bgm || ''}" data-locked="${p.isLocked ? '1' : ''}" data-pass="${p.password || ''}" style="background:${p.background}">`;
            if (p.texture) html += `<div style="position:absolute;inset:0;background-image:url('${p.texture}');background-size:cover;opacity:.2"></div>`;
            p.elements.filter(e => !e.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach(e => { html += elementToHTML(e) });
            html += `</div></div>`;
        });

        html += `</div>`; // End reader-main

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
            if(!muted) btn.classList.add('active'); else btn.classList.remove('active');
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

        html += `<div class="reader-controls"><button class="btn" onclick="prev()">◀ Previous</button><span id="pg">1/${project.pages.length}</span><button class="btn" onclick="next()">Next ▶</button></div>`;
        html += `<div class="modal" id="pw"><div class="modal-content"><h3>🔒 Locked</h3><p>Enter password to unlock path</p><input type="password" id="pi"><div style="display:flex;gap:10px"><button class="btn" onclick="PWS()" style="flex:1">Unlock</button><button class="btn" onclick="document.getElementById('pw').classList.remove('active')" style="flex:1;background:#333;color:#fff">Cancel</button></div></div></div>`;
        html += `<script>${MINI_MUSHU}</script><script>${sc}</script><script>${msc}</script></body></html>`;

        const blob = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'svrn-zine.html'; a.click();
        ld.remove();
    }, 300);
}

export const exportToInteractive = async (project, embedAssets = false) => {
    const ld = document.createElement('div');
    ld.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#fff";
    ld.innerHTML = '<div>Building Interactive Zine...</div>';
    document.body.appendChild(ld);

    let pageFlipScript = `<script src="/libs/page-flip.browser.js"></script>`;
    if (embedAssets) {
        try {
            ld.innerHTML = '<div>Fetching libraries...</div>';
            const res = await fetch('/libs/page-flip.browser.js');
            if (res.ok) {
                const text = await res.text();
                pageFlipScript = `<script>${text}</script>`;
            }
        } catch (e) {
            console.warn('Failed to fetch page-flip for embedding');
        }
    }

    timeoutTracker = setTimeout(() => {
        let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>SVRN Publishing Zine</title>
        <link rel="stylesheet" href="/fonts/fonts.css">
        ${pageFlipScript}
        <style>
            body{margin:0;padding:0;background:#121212;color:#e0e0e0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;overflow:hidden;height:100vh;display:flex;flex-direction:column}
            .reader-header{padding:15px 20px;background:#1a1a1a;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;z-index:10}
            .reader-title{font-weight:700;letter-spacing:1px;color:#d4af37;font-size:1.1em}
            .book-stage{flex:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center,#2a2a2a 0%,#121212 100%);position:relative;}
            #book{margin:auto;}
            .page{background-color:#fff;overflow:hidden;position:relative;display:none;box-shadow:inset 0 0 20px rgba(0,0,0,0.1)} 
            .page.-active{display:block}
            .el{position:absolute}
            .mute-btn{width:32px;height:32px;border:1px solid #444;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#666;transition:all 0.2s}
            .mute-btn:hover{border-color:#d4af37;color:#d4af37}
            .mute-btn.active{background:#d4af37;color:#000;border-color:#d4af37}
            
            #vp-overlay{position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.5s}
            .start-btn{padding:15px 40px;font-size:18px;background:transparent;color:#d4af37;border:2px solid #d4af37;cursor:pointer;border-radius:4px;font-weight:bold;margin-top:30px;font-family:sans-serif;text-transform:uppercase;letter-spacing:2px;transition:all 0.3s}
            .start-btn:hover{transform:scale(1.05)}
            .btn-audio{width:32px;height:32px;border-radius:50%;border:1px solid #d4af37;background:transparent;color:#d4af37;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s}
            .btn-audio:hover{background:#d4af37;color:#000}
        </style></head><body>`;

        html += `<div id="vp-overlay"><h1 style="color:#fff;font-size:3rem;margin-bottom:0.5rem;font-family:sans-serif;letter-spacing:4px">SVRN PUBLISHING</h1><div style="color:#666;letter-spacing:2px;font-size:0.9rem">SOVEREIGN INTERACTIVE ZINE READER</div><button class="start-btn" onclick="startZine()">ENTER REALITY</button></div>`;

        html += `<div class="reader-header">
            <div class="reader-title">${project.title || 'UNTITLED ZINE'}</div>
            <button id="vp-mute" class="mute-btn" onclick="toggleMute()" title="Toggle Audio">♪</button>
        </div>`;

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
            if(!muted) btn.classList.add('active'); else btn.classList.remove('active');
            if(muted) { Gen.stop(); if(au) au.pause(); } else { if(curMood) Gen.play(curMood); if(au) au.play(); }
        };
        window.startZine = () => {
            const ov = document.getElementById('vp-overlay'); ov.style.opacity = 0;
            setTimeout(() => { ov.remove(); Gen.init();
                const el = document.getElementById('book');
                pf = new St.PageFlip(el, { width: ${PAGE_W}, height: ${PAGE_H}, size: 'fixed', minWidth: 300, maxWidth: 1000, minHeight: 400, maxHeight: 1400, maxShadowOpacity: 0.5, showCover: true, mobileScrollSupport: false });
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
        const blob = new Blob([html], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'svrn-interactive.html'; a.click();
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

        if (!window.jspdf) await loadScript('/libs/jspdf.umd.min.js');
        if (!window.html2canvas) await loadScript('/libs/html2canvas.min.js');

        let mushu;
        try {
            const m = await (new Function('return import("/libs/mushu-flow.js")'))();
            mushu = m.mushu;
        } catch (e) { console.warn('Failed to load mushu for PDF export', e); }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_W, PAGE_H] });

        const container = document.createElement('div');
        container.style.cssText = `position:absolute;left:-9999px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:#fff`;
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
                pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_W, PAGE_H);

                p.elements.forEach(e => { if (e.shaderImage) delete e.shaderImage; });
            }
            pdf.save('svrn-zine.pdf');
        } finally {
            container.remove();
        }
    } catch (e) {
        console.error(e);
        alert('PDF export failed: ' + e.message);
    }
    ld.remove();
}

export const exportToFoldablePDF = async (project, embedAssets = false) => {
    const ld = document.createElement('div');
    ld.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#fff";
    ld.innerHTML = '<div>Initializing Foldable Zine Export...</div>';
    document.body.appendChild(ld);

    const SHEET_W = 1056;
    const SHEET_H = 816;
    const CELL_W = SHEET_W / 4; // 264
    const CELL_H = SHEET_H / 2; // 408
    // Classic one-sheet 8-page zine imposition (relative indices within a signature):
    // Top row (180deg): 4, 3, 2, 1 | Bottom row (0deg): 5, 6, 7, 0
    const PAGE_INDEX_MAP = [4, 3, 2, 1, 5, 6, 7, 0];
    const PAGE_TRANSFORMS = [
        { x: 0, y: 0, rot: 180 }, { x: CELL_W, y: 0, rot: 180 }, { x: CELL_W * 2, y: 0, rot: 180 }, { x: CELL_W * 3, y: 0, rot: 180 },
        { x: 0, y: CELL_H, rot: 0 }, { x: CELL_W, y: CELL_H, rot: 0 }, { x: CELL_W * 2, y: CELL_H, rot: 0 }, { x: CELL_W * 3, y: CELL_H, rot: 0 }
    ];
    const blankPage = () => ({ elements: [], background: '#ffffff', texture: null });

    try {
        const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector('script[src="' + src + '"]')) return resolve();
            const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
        });

        if (!window.jspdf) await loadScript('/libs/jspdf.umd.min.js');
        if (!window.html2canvas) await loadScript('/libs/html2canvas.min.js');

        let mushu;
        try {
            const m = await (new Function('return import("/libs/mushu-flow.js")'))();
            mushu = m.mushu;
        } catch (e) { console.warn('Failed to load mushu for foldable PDF export', e); }

        const { jsPDF } = window.jspdf;
        // Landscape Letter (11x8.5 inches at 96PPI) -> 1056 x 816 px
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [SHEET_W, SHEET_H] });

        const container = document.createElement('div');
        container.style.cssText = `position:absolute;left:-9999px;top:0;width:${SHEET_W}px;height:${SHEET_H}px;overflow:hidden;background:#fff`;
        document.body.appendChild(container);

        try {
            const sourcePages = project.pages || [];
            const sheetCount = Math.max(1, Math.ceil(sourcePages.length / 8));

            // Pre-render shaders for every project page once
            if (mushu) {
                ld.innerHTML = `<div>Rendering shaders…</div>`;
                for (const p of sourcePages) {
                    for (const el of (p.elements || [])) {
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
            }

            for (let sheet = 0; sheet < sheetCount; sheet++) {
                ld.innerHTML = `<div>Generating foldable sheet ${sheet + 1} of ${sheetCount}…</div>`;

                const offset = sheet * 8;
                const pages = [];
                for (let i = 0; i < 8; i++) {
                    pages.push(sourcePages[offset + i] || blankPage());
                }

                let htmlString = '';
                for (let i = 0; i < 8; i++) {
                    const p = pages[PAGE_INDEX_MAP[i]];
                    const tr = PAGE_TRANSFORMS[i];
                    htmlString += `<div style="position:absolute;left:${tr.x}px;top:${tr.y}px;width:${CELL_W}px;height:${CELL_H}px;
                        transform:rotate(${tr.rot}deg);transform-origin:center center;background:${p.background || '#fff'};overflow:hidden;border:1px dashed #eee">
                        <div style="transform:scale(0.5);transform-origin:top left;width:${PAGE_W}px;height:${PAGE_H}px;position:relative;">
                            ${p.texture ? `<div style="position:absolute;inset:0;background-image:url('${p.texture}');background-size:cover;opacity:.2"></div>` : ''}
                            ${(p.elements || []).filter(e => !e.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(e => elementToHTML(e, false)).join('')}
                        </div>
                    </div>`;
                }

                container.innerHTML = htmlString;
                await new Promise(r => setTimeout(r, 200));

                const canvas = await window.html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    imageTimeout: 5000
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);

                if (sheet > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, SHEET_W, SHEET_H);
            }

            // Cleanup shader snapshots
            sourcePages.forEach(p => (p.elements || []).forEach(e => { if (e.shaderImage) delete e.shaderImage; }));

            pdf.save('svrn-foldable-zine.pdf');
        } finally {
            container.remove();
        }
    } catch (e) {
        console.error(e);
        alert('Foldable PDF export failed: ' + e.message);
    }
    ld.remove();
}

// Helper function — keep defaults aligned with ElementContent / Reader
const BALLOON_EXPORT = {
    dialog: 'background:#fff;border:2px solid #000;border-radius:20px;padding:10px;display:flex;align-items:center;justify-content:center;text-align:center;',
    thought: 'background:#fff;border:2px solid #000;border-radius:50%;padding:10px;display:flex;align-items:center;justify-content:center;text-align:center;',
    shout: 'background:#fff;border:4px solid #000;padding:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;text-align:center;',
    caption: 'background:#000;color:#fff;padding:10px;display:flex;align-items:center;justify-content:center;text-align:center;',
    whisper: 'background:#f8f8f8;border:1px dashed #999;border-radius:16px;padding:10px;font-style:italic;display:flex;align-items:center;justify-content:center;text-align:center;',
    narration: 'background:#ffe;border:1px solid #cc9;padding:10px;font-style:italic;display:flex;align-items:center;justify-content:center;text-align:center;'
}

const elementToHTML = (el, isExport = true) => {
    let s = `position:absolute;left:${el.x || 0}px;top:${el.y || 0}px;width:${el.width}px;height:${el.height}px;transform:rotate(${el.rotation || 0}deg);z-index:${el.zIndex || 0};opacity:${el.opacity ?? 1};mix-blend-mode:${el.blendMode || 'normal'};box-sizing:border-box;`
    if (el.isHidden) s += 'display:none;'
    if (el.shadow) s += `box-shadow:${el.shadow};`
    if (el.blur) s += `filter:blur(${el.blur}px);`
    else if (el.filter) s += `filter:${el.filter};`
    if (el.borderWidth) s += `border:${el.borderWidth}px solid ${el.borderColor || '#000'};`
    if (el.borderRadius) s += `border-radius:${el.borderRadius}px;`

    let content = ''
    const handler = isExport ? 'H' : 'VP.handleInteraction'
    if (el.type === 'text' || el.type === 'balloon') {
        s += `font-size:${el.fontSize || (el.type === 'balloon' ? 14 : 16)}px;font-family:${el.fontFamily || 'var(--font-body, sans-serif)'};color:${el.color || '#000'};text-align:${el.align || (el.type === 'balloon' ? 'center' : 'left')};`
        if (el.bold) s += 'font-weight:bold;'
        if (el.italic) s += 'font-style:italic;'
        if (el.lineHeight) s += `line-height:${el.lineHeight};`
        if (el.letterSpacing) s += `letter-spacing:${el.letterSpacing}px;`
        if (el.textShadow) s += `text-shadow:${el.textShadow};`
        if (el.strokeWidth) s += `-webkit-text-stroke:${el.strokeWidth}px ${el.strokeColor || '#fff'};`
        if (el.type === 'text') s += 'padding:4px;'
        content = el.content || ''
        if (el.type === 'balloon') {
            s += BALLOON_EXPORT[el.balloonType || 'dialog'] || BALLOON_EXPORT.dialog
        }
    }
    if (el.type === 'image') {
        const fit = el.objectFit || 'contain'
        const radius = el.imgRadius ? `border-radius:${el.imgRadius}px;` : ''
        content = `<img src="${el.src}" style="width:100%;height:100%;object-fit:${fit};display:block;${radius}" alt="">`
    }
    if (el.type === 'video') content = `<video src="${el.src}" controls style="width:100%;height:100%;object-fit:${el.objectFit || 'contain'}"></video>`
    if (el.type === 'audio-log') {
        content = `<div class="audio-log-wrap" style="display:flex;flex-direction:column;width:100%;height:100%;background:rgba(0,0,0,0.5);border:1px solid #d4af37;padding:10px;box-sizing:border-box;color:#fff">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <button class="btn-audio" data-src="${el.src}" onclick="playAudioLog(this)">▶</button>
                <div style="font-weight:bold">${el.label || 'AUDIO LOG'}</div>
            </div>
            <canvas width="${el.width}" height="${el.height - 50}" style="flex:1;width:100%;background:#000;border-radius:4px" data-theme="${el.vizTheme || 'bars'}"></canvas>
        </div>`
    }
    if (el.type === 'panel') {
        if (el.panelBorderWidth !== undefined) {
            s += `border:${el.panelBorderWidth}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'};`
        } else {
            s += `border:var(--panel-border);`
        }
        s += `background:${el.fill || 'transparent'};border-radius:${el.panelRadius !== undefined ? el.panelRadius + 'px' : 'var(--radius)'};`
        if (el.panelShadow) s += `box-shadow:${el.panelShadow};`
    }
    if (el.type === 'shape') {
        if (el.shape === 'triangle') {
            s += `background:transparent;width:0;height:0;border-left:${(el.width || 0) / 2}px solid transparent;border-right:${(el.width || 0) / 2}px solid transparent;border-bottom:${el.height || 0}px solid ${el.fill || '#000'};`
        } else if (el.shape === 'diamond') {
            s += `background:${el.fill || '#000'};transform:rotate(${(el.rotation || 0) + 45}deg);`
        } else {
            s += `background:${el.fill || '#000'};`
            if (el.shape === 'circle') s += 'border-radius:50%;'
        }
    }
    if (el.type === 'shader') {
        if (el.shaderImage) {
            content = `<img src="${el.shaderImage}" style="width:100%;height:100%;object-fit:cover" alt="">`
        } else {
            content = `<canvas class="vp-shader-canvas" data-code="${btoa(unescape(encodeURIComponent(el.shaderCode || '')))}" style="width:100%;height:100%"></canvas>`
        }
    }
    if (el.animation && el.animation !== 'none') s += `animation:${el.animation} ${el.animDuration || 1}s ease ${el.animLoop ? 'infinite' : 'both'};`

    let attr = `style="${s}" class="reader-el-item" data-label="${el.label || ''}"`
    if (el.action) {
        attr = `style="${s}cursor:pointer" class="reader-el-item" data-label="${el.label || ''}" data-action="${el.action}" data-action-val="${el.actionVal || ''}" onclick="${handler}(this, event)"`
    }
    return `<div ${attr}>${content}</div>`
}
