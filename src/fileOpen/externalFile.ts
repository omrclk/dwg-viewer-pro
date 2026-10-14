export type ExternalFilePayload = {
  id?: string
  name?: string
  mimeType?: string
  base64?: string
  size?: number
  chunked?: boolean
  sourcePath?: string
  message?: string
}

/** Native retries the same open event for several seconds while the WebView starts. */
export const EXTERNAL_FILE_DEDUPE_MS = 12_000

const claimedAt = new Map<string, number>()

export function claimExternalFile(id: string | undefined, now = Date.now()): boolean {
  if (!id) return true
  const previous = claimedAt.get(id)
  if (previous !== undefined && now - previous < EXTERNAL_FILE_DEDUPE_MS) return false
  claimedAt.set(id, now)
  return true
}

export function resetExternalFileClaims() {
  claimedAt.clear()
}

function bytesFromBase64(value: string) {
  const binary = globalThis.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

type NativeChunkBridge = {
  pullChunk?: (offset: number, length: number) => string
  clearPending?: () => void
}

export function fileFromPayload(payload: ExternalFilePayload, native?: NativeChunkBridge) {
  const bridge = native ?? (typeof window === 'undefined' ? undefined : window.DwgNative)
  if (payload.chunked && bridge?.pullChunk && payload.size) {
    const parts: Uint8Array[] = []
    const slice = 256 * 1024
    for (let offset = 0; offset < payload.size; offset += slice) {
      const encoded = bridge.pullChunk(offset, Math.min(slice, payload.size - offset))
      if (!encoded) throw new Error('Dosya parçası okunamadı.')
      parts.push(bytesFromBase64(encoded))
    }
    bridge?.clearPending?.()
    return new File(parts, payload.name || 'paylasilan-cizim.dwg', {
      type: payload.mimeType || 'application/octet-stream',
    })
  }
  if (!payload.base64) throw new Error('Dosya verisi alınamadı.')
  return new File([bytesFromBase64(payload.base64)], payload.name || 'paylasilan-cizim.dwg', {
    type: payload.mimeType || 'application/octet-stream',
  })
}
