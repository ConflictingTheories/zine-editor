/** Project-level editor modes: tailor chrome and defaults without changing the zine data model. */

export const EDITOR_MODE_ZINE = 'zine'
export const EDITOR_MODE_PHOTO_PORTFOLIO = 'photo-portfolio'

export const EDITOR_MODES = [
    {
        id: EDITOR_MODE_ZINE,
        label: 'Interactive Zine',
        shortLabel: 'Zine',
        description: 'Full toolkit for comics, stories, shaders, and interactive pages.'
    },
    {
        id: EDITOR_MODE_PHOTO_PORTFOLIO,
        label: 'Photo Portfolio',
        shortLabel: 'Portfolio',
        description: 'Streamlined layout for photography: images, grids, and portfolio templates.'
    }
]

export const editorModeMeta = (modeId) =>
    EDITOR_MODES.find(mode => mode.id === modeId) || EDITOR_MODES[0]

export const defaultThemeForMode = (modeId) =>
    modeId === EDITOR_MODE_PHOTO_PORTFOLIO ? 'editorial' : 'classic'
