const fs = require('fs');
const https = require('https');

const fetch = (url, options = {}) => new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return resolve(fetch(res.headers.location, options));
        }
        const data = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => resolve({
            text: () => Buffer.concat(data).toString(),
            buffer: () => Buffer.concat(data)
        }));
    }).on('error', reject);
});

const fontUrl = 'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;700;900&family=Bebas+Neue&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Special+Elite&family=Bangers&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Orbitron:wght@400;700;900&family=Roboto+Mono:wght@400;700&family=Montserrat:wght@400;700&family=Assistant:wght@400;700&family=Comic+Neue:wght@400;700&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=MedievalSharp&family=Inter:wght@300;400;500;600;700&display=swap';

const libs = {
    'jspdf.umd.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'html2canvas.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'page-flip.browser.js': 'https://unpkg.com/page-flip@2.0.7/dist/js/page-flip.browser.js',
    'mushu-flow.js': 'https://unpkg.com/mushu-flow@1.1.0/src/index.js'
};

async function run() {
    console.log('Downloading fonts...');
    try { fs.mkdirSync('public/fonts', { recursive: true }); } catch (e) { }

    const res = await fetch(fontUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36' } });
    let css = await res.text();
    const urls = [...css.matchAll(/url\((https:\/\/[^\)]+)\)/g)].map(m => m[1]);

    // Unique URLs
    const uniqueUrls = [...new Set(urls)];

    for (let i = 0; i < uniqueUrls.length; i++) {
        const u = uniqueUrls[i];
        const res2 = await fetch(u);
        const buf = await res2.buffer();
        const fname = `f_${i}.woff2`;
        fs.writeFileSync(`public/fonts/${fname}`, buf);
        // Replace all instances of this URL
        css = css.split(u).join(`/fonts/${fname}`);
        if (i % 10 === 0) console.log(`Downloaded ${i}/${uniqueUrls.length} fonts`);
    }
    fs.writeFileSync('public/fonts/fonts.css', css);
    console.log('Fonts downloaded.');

    console.log('Downloading libraries...');
    try { fs.mkdirSync('public/libs', { recursive: true }); } catch (e) { }

    for (const [name, url] of Object.entries(libs)) {
        const res = await fetch(url);
        fs.writeFileSync(`public/libs/${name}`, await res.buffer());
        console.log(`Downloaded ${name}`);
    }
    console.log('Done.');
}
run();
