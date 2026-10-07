/*
 * Worker: gradeWorker
 * Grades a 16-bit frame off the UI thread. A full-resolution NEF decode is
 * ~72M pixels × the full reference grade, so running it on the main thread
 * froze the editor for seconds. Messages in: { id, frame, recipe }; out:
 * { id, frame } or { id, error }.
 */

import { gradeFrame16 } from './lightTablePipeline.js'

self.onmessage = ({ data }) => {
    const { id, frame, recipe } = data || {}
    try {
        const result = gradeFrame16(frame, recipe)
        self.postMessage({ id, frame: result }, [result.data.buffer])
    } catch (err) {
        self.postMessage({ id, error: err?.message || 'grade failed' })
    }
}
