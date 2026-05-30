export function buildTextPayload(text) {
  return JSON.stringify({ t: 'text', b: text })
}

export function buildMediaPayload({ name, mime, size, path, inline, data }) {
  const base = {
    t: 'media',
    name,
    mime: mime || 'application/octet-stream',
    size,
  }
  if (inline && data) {
    return JSON.stringify({ ...base, inline: true, data })
  }
  return JSON.stringify({ ...base, path })
}

export function parseMessagePayload(plaintext) {
  if (!plaintext || plaintext.startsWith('[')) {
    return { t: 'error', message: plaintext || 'Message indéchiffrable' }
  }

  try {
    const data = JSON.parse(plaintext)
    if (data?.t === 'text' && typeof data.b === 'string') {
      return data
    }
    if (data?.t === 'media' && data.name && (data.path || (data.inline && data.data))) {
      return data
    }
  } catch {
    // Anciens messages : texte brut non JSON
  }

  return { t: 'text', b: plaintext }
}
