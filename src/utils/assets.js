/* Resolve known library assets to local files so editions remain available offline. */
const LOCAL_ASSET_ALIASES = {
    'https://www.transparenttextures.com/patterns/old-mathematics.png': '/assets/textures/old-paper.svg',
    'https://www.transparenttextures.com/patterns/dark-matter.png': '/assets/textures/dark-matter.svg'
}

export const resolvePublicationAsset = (source) => LOCAL_ASSET_ALIASES[source] || source || ''
