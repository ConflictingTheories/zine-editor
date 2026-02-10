export const exportToHTML = (project) => {
    let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${project.title}</title>
    <style>
        body{margin:0;padding:20px;background:#111;font-family:Arial,sans-serif}
        .page-wrap{max-width:528px;margin:0 auto;display:none;position:relative;aspect-ratio:5.5/8.5;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.5);overflow:hidden}
        .page-wrap.active{display:block}
        .el{position:absolute}
        .nav{text-align:center;padding:20px}.btn{padding:10px 24px;background:#d4af37;color:#000;border:none;cursor:pointer;font-weight:600;margin:0 8px;border-radius:6px}
        #pg{color:#aaa;margin:0 16px}
    </style></head><body>`

    project.pages.forEach((p, i) => {
        html += `<div class="page-wrap${i === 0 ? ' active' : ''}" id="p${i}" style="background:${p.background || '#fff'}">`
        if (p.texture) html += `<div style="position:absolute;inset:0;background-image:url('${p.texture}');background-size:cover;opacity:.2"></div>`

        p.elements.forEach(el => {
            let s = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;transform:rotate(${el.rotation || 0}deg);z-index:${el.zIndex || 0};opacity:${el.opacity ?? 1};mix-blend-mode:${el.blendMode || 'normal'};`
            let content = ''

            if (el.type === 'text' || el.type === 'balloon') {
                s += `font-size:${el.fontSize}px;font-family:${el.fontFamily || 'sans-serif'};color:${el.color || '#000'};text-align:${el.align || 'left'};`
                if (el.bold) s += 'font-weight:bold;'
                if (el.italic) s += 'font-style:italic;'
                content = el.content || ''
                if (el.type === 'balloon') {
                    if (el.balloonType === 'dialog') s += 'background:#fff;border:2px solid #000;border-radius:20px;padding:10px;'
                }
            } else if (el.type === 'image') {
                content = `<img src="${el.src}" style="width:100%;height:100%;object-fit:${el.objectFit || 'cover'}">`
            }

            html += `<div style="${s}">${content}</div>`
        })
        html += `</div>`
    })

    html += `<div class="nav"><button class="btn" onclick="prev()">◀ Prev</button><span id="pg">1/${project.pages.length}</span><button class="btn" onclick="next()">Next ▶</button></div>`
    html += `<script>
        let c=0, t=${project.pages.length};
        function show(n){
            if(n<0||n>=t)return; c=n;
            for(let i=0;i<t;i++){ document.getElementById('p'+i).classList.toggle('active', i===n); }
            document.getElementById('pg').textContent=(n+1)+'/'+t;
        }
        function next(){ show(c+1); }
        function prev(){ show(c-1); }
    </script></body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${project.title.replace(/\s+/g, '_')}.html`
    a.click()
}

export const exportToPDF = async (project) => {
    alert('PDF Export requires jsPDF and html2canvas. In this React version, please use "Print to PDF" from the HTML export for best results.')
}
