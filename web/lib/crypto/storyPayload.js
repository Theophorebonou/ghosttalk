export function buildTextStoryPayload(text) {
  return JSON.stringify({ t: 'text', b: text })
}

export function buildImageStoryPayload({ name, mime, path, inline, data }) {
  const base = { t: 'image', name, mime: mime || 'image/jpeg' }
  if (inline && data) {
    return JSON.stringify({ ...base, inline: true, data })
  }
  return JSON.stringify({ ...base, path })
}

export function parseStoryPayload(plaintext) {
  try {
    const data = JSON.parse(plaintext)
    if (data?.t === 'text' && typeof data.b === 'string') return data
    if (data?.t === 'image' && (data.path || (data.inline && data.data))) return data
  } catch {
    /* ancien format */
  }
  return { t: 'text', b: plaintext }
}
