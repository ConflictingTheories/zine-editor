import { unpackSvrn } from '../../svrn-format/src/index.js'

/** Loads and verifies a portable zine. Existing React readers consume `project`. */
export async function loadSvrn(input) { return unpackSvrn(input) }

export function assetUrl(entry, assetPath) {
  const bytes = entry.entries?.[assetPath]
  return bytes ? URL.createObjectURL(new Blob([bytes])) : assetPath
}
