import { supabase } from '@/lib/supabase/client'

export async function getStickerPacks() {
  const { data, error } = await supabase
    .from('sticker_packs')
    .select('*')
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function getStickers(packId) {
  const { data, error } = await supabase
    .from('stickers')
    .select('*')
    .eq('pack_id', packId)
    .order('created_at')

  if (error) throw error
  return data ?? []
}

export async function searchStickers(query) {
  if (!query.trim()) return []

  const { data, error } = await supabase
    .from('stickers')
    .select('*')
    .or(`emoji.ilike.%${query}%,keywords.cs.{${query}}`)
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function getRecentStickers(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Pour l'instant, retourner les stickers officiels
  // Plus tard: implémenter un système de stickers récents par utilisateur
  const { data, error } = await supabase
    .from('stickers')
    .select('*, sticker_packs (*)')
    .in('pack_id', (await getStickerPacks()).filter(p => p.is_official).map(p => p.id))
    .limit(limit)

  if (error) throw error
  return data ?? []
}
