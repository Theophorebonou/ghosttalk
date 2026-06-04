export function buildTextPayload(
  text,
  replyTo = null,
  ephemeral = null,
  storyReply = null,
  forwarded = null
) {
  const payload = { t: 'text', b: text }
  if (replyTo) payload.replyTo = replyTo
  if (ephemeral) payload.ephemeral = ephemeral
  if (storyReply) payload.storyReply = storyReply
  if (forwarded) payload.forwarded = forwarded
  return JSON.stringify(payload)
}

export function buildForwardPayload(originalPayload, forwardMeta) {
  if (originalPayload?.t === 'text') {
    return buildTextPayload(originalPayload.b, null, null, null, forwardMeta)
  }
  if (originalPayload?.t === 'media') {
    return JSON.stringify({ ...originalPayload, forwarded: forwardMeta })
  }
  return buildTextPayload('Message transféré', null, null, null, forwardMeta)
}

export function buildMediaPayload({
  name,
  mime,
  size,
  path,
  inline,
  data,
  replyTo = null,
  ephemeral = null,
}) {
  const base = {
    t: 'media',
    name,
    mime: mime || 'application/octet-stream',
    size,
  }
  if (replyTo) base.replyTo = replyTo
  if (ephemeral) base.ephemeral = ephemeral

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
      const out = { t: 'text', b: data.b }
      if (data.replyTo) out.replyTo = data.replyTo
      if (data.storyReply) out.storyReply = data.storyReply
      if (data.ephemeral) out.ephemeral = data.ephemeral
      if (data.forwarded) out.forwarded = data.forwarded
      return out
    }
    if (data?.t === 'media' && data.name && (data.path || (data.inline && data.data))) {
      const out = { ...data }
      if (data.forwarded) out.forwarded = data.forwarded
      return out
    }
  } catch {
    // Anciens messages : texte brut non JSON
  }

  return { t: 'text', b: plaintext }
}
