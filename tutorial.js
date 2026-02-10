// ═══════════════════════════════════════════
// VOID PRESS - Tutorial Zine Template
// ═══════════════════════════════════════════

const getTutorialData = () => {
    const gen = () => 'tut_' + Math.random().toString(36).substr(2, 9);

    return {
        id: 'tutorial_zine',
        title: 'Making Your First Zine',
        theme: 'classic',
        pages: [
            {
                id: Date.now() + 1,
                background: '#1a1a24',
                elements: [
                    { id: gen(), type: 'text', x: 40, y: 180, width: 448, height: 100, content: 'MAKING YOUR FIRST ZINE', fontSize: 48, fontFamily: 'Cinzel', color: '#d4af37', align: 'center', bold: true, zIndex: 1 },
                    { id: gen(), type: 'text', x: 40, y: 300, width: 448, height: 40, content: 'A Guide to the Void Press Engine', fontSize: 18, fontFamily: 'EB Garamond', color: '#bdc3c7', align: 'center', italic: true, zIndex: 2 },
                    { id: gen(), type: 'shape', shape: 'line_h', x: 140, y: 360, width: 248, height: 3, fill: '#d4af37', opacity: .6, zIndex: 3 },
                    { id: gen(), type: 'text', x: 164, y: 500, width: 200, height: 40, content: 'CLICK TO START', fontSize: 16, fontFamily: 'Inter', color: '#000', align: 'center', bold: true, zIndex: 4, action: 'goto', actionVal: '2', fill: '#d4af37', borderRadius: 4, panelBorderWidth: 0 }
                ]
            },
            {
                id: Date.now() + 2,
                background: '#fdfaf1',
                elements: [
                    { id: gen(), type: 'text', x: 40, y: 40, width: 448, height: 40, content: '1. The Basics', fontSize: 24, fontFamily: 'Playfair Display', color: '#1a1a1a', align: 'left', bold: true, zIndex: 1 },
                    { id: gen(), type: 'text', x: 40, y: 100, width: 448, height: 150, content: 'Drag elements anywhere on the canvas. Use the right panel to change colors, fonts, and logic.\n\nTry selecting this text to see its properties!', fontSize: 16, fontFamily: 'EB Garamond', color: '#333', align: 'left', zIndex: 2 },
                    { id: gen(), type: 'panel', x: 40, y: 300, width: 448, height: 200, fill: '#eee', panelBorderWidth: 2, panelBorderColor: '#ccc', panelRadius: 8, zIndex: 0 },
                    { id: gen(), type: 'text', x: 60, y: 320, width: 408, height: 40, content: 'This is a Panel (Background)', fontSize: 14, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 1 }
                ]
            },
            {
                id: Date.now() + 3,
                background: '#0a0a0f',
                elements: [
                    { id: gen(), type: 'shader', x: 0, y: 0, width: 528, height: 816, shaderPreset: 'plasma', opacity: 0.3, zIndex: 0 },
                    { id: gen(), type: 'text', x: 40, y: 40, width: 448, height: 40, content: '2. Magic & FX', fontSize: 24, fontFamily: 'Orbitron', color: '#00f3ff', align: 'left', bold: true, zIndex: 1 },
                    { id: gen(), type: 'text', x: 40, y: 100, width: 448, height: 100, content: 'You can add Shaders for dynamic backgrounds and Action FX for drama.', fontSize: 16, fontFamily: 'Roboto Mono', color: '#fff', align: 'left', zIndex: 2 },
                    { id: gen(), type: 'text', x: 164, y: 300, width: 200, height: 50, content: 'CAST FLASH', fontSize: 18, fontFamily: 'Orbitron', color: '#fff', align: 'center', bold: true, zIndex: 3, action: 'vfx', actionVal: 'flash', fill: '#bc00ff', borderRadius: 8 }
                ]
            },
            {
                id: Date.now() + 4,
                background: '#fff',
                elements: [
                    { id: gen(), type: 'text', x: 40, y: 40, width: 448, height: 40, content: '3. Mystery & Interactivity', fontSize: 24, fontFamily: 'Cinzel', color: '#5c0a0a', align: 'left', bold: true, zIndex: 1 },
                    { id: gen(), type: 'text', x: 40, y: 100, width: 448, height: 150, content: 'Pages can be "Locked". These are hidden from the normal flow until a user finds the key.\n\nClick the button below to solve the puzzle!', fontSize: 16, fontFamily: 'Special Elite', color: '#000', align: 'left', zIndex: 2 },
                    { id: gen(), type: 'text', x: 114, y: 350, width: 300, height: 60, content: 'UNLOCK THE SECRET ROOM', fontSize: 16, fontFamily: 'Cinzel', color: '#fff', align: 'center', bold: true, zIndex: 3, action: 'password', actionVal: '5', fill: '#5c0a0a', borderRadius: 0 },
                    { id: gen(), type: 'text', x: 40, y: 450, width: 448, height: 40, content: '(The password is "VOID")', fontSize: 12, fontFamily: 'Courier Prime', color: '#999', align: 'center', italic: true, zIndex: 4 }
                ]
            },
            {
                id: Date.now() + 5,
                isLocked: true,
                password: 'VOID',
                background: '#000',
                elements: [
                    { id: gen(), type: 'text', x: 40, y: 200, width: 448, height: 100, content: 'YOU FOUND IT!', fontSize: 48, fontFamily: 'Cinzel Decorative', color: '#d4af37', align: 'center', bold: true, zIndex: 1 },
                    { id: gen(), type: 'text', x: 40, y: 320, width: 448, height: 80, content: 'This page was hidden. Locked pages are perfect for mystery zines or hidden endings.', fontSize: 18, fontFamily: 'Crimson Text', color: '#fff', align: 'center', zIndex: 2 }
                ]
            },
            {
                id: Date.now() + 6,
                background: '#f8f8fa',
                elements: [
                    { id: gen(), type: 'text', x: 40, y: 40, width: 448, height: 40, content: '4. Hidden Objects', fontSize: 24, fontFamily: 'Playfair Display', color: '#1a1a1a', align: 'left', bold: true, zIndex: 1 },
                    { id: gen(), type: 'text', x: 40, y: 100, width: 448, height: 80, content: 'Some items aren\'t locked, just invisible! Click the Magnifying Glass to investigate.', fontSize: 16, fontFamily: 'EB Garamond', color: '#333', align: 'left', zIndex: 2 },
                    { id: gen(), type: 'text', x: 164, y: 250, width: 200, height: 50, content: '🔍 INVESTIGATE', fontSize: 18, fontFamily: 'Inter', color: '#fff', align: 'center', bold: true, zIndex: 3, action: 'toggle', actionVal: 'clue', fill: '#333', borderRadius: 4 },
                    { id: gen(), label: 'clue', isHidden: true, type: 'text', x: 114, y: 400, width: 300, height: 150, content: '📜 TRUTH:\nYou are now a Void Press Master. Go forth and create!', fontSize: 20, fontFamily: 'Special Elite', color: '#5c0a0a', align: 'center', zIndex: 4 }
                ]
            }
        ]
    };
};

if (typeof module !== 'undefined') module.exports = getTutorialData;
else window.getTutorialData = getTutorialData;
