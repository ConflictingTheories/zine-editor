/** Print is an intentional edition, not a broken version of the digital work. */
export const printElements = (elements = []) => elements
    .filter(element => !element.hidden && element.printMode !== 'hide')
    .map(element => {
        if (element.printMode !== 'fallback') return element
        return {
            ...element,
            type: 'text',
            content: element.printFallback || `[${element.type.toUpperCase()} — see digital edition]`,
            fontFamily: element.fontFamily || 'Inter',
            fontSize: element.fontSize || 12,
            color: element.color || '#111',
            align: element.align || 'center',
            animation: 'none',
            action: ''
        }
    })

export const getPrintReadiness = (project) => (project?.pages || []).reduce((summary, page) => {
    for (const element of page.elements || []) {
        if (element.hidden) continue
        if (element.printMode === 'hide') summary.hidden += 1
        else if (element.printMode === 'fallback') summary.fallbacks += 1
        else if (['video', 'audio-log', 'shader', 'object'].includes(element.type) || element.action) summary.review += 1
    }
    return summary
}, { hidden: 0, fallbacks: 0, review: 0 })
