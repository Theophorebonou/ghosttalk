import { supabase } from '@/lib/supabase/client'

export async function getFolders() {
  const result = await supabase.auth.getUser()
  if (!result?.data?.user) return []

  const user = result.data.user
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', user.id)
    .order('position')

  if (error) throw error
  return data ?? []
}

export async function createFolder(name, icon = '📁') {
  const result = await supabase.auth.getUser()
  if (!result?.data?.user) throw new Error('Non authentifié')

  const user = result.data.user

  // Récupérer la position maximale
  const { data: existing } = await supabase
    .from('folders')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing?.[0]?.position + 1 || 0

  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: user.id,
      name,
      icon,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateFolder(folderId, updates) {
  const { data, error } = await supabase
    .from('folders')
    .update(updates)
    .eq('id', folderId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteFolder(folderId) {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId)

  if (error) throw error
}

export async function addFolderFilter(folderId, filterType, filterValue) {
  const { data, error } = await supabase
    .from('folder_filters')
    .insert({
      folder_id: folderId,
      filter_type: filterType,
      filter_value: filterValue,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function removeFolderFilter(filterId) {
  const { error } = await supabase
    .from('folder_filters')
    .delete()
    .eq('id', filterId)

  if (error) throw error
}

export async function getFolderConversations(folderId) {
  const { data, error } = await supabase.rpc('get_folder_conversations', {
    folder_id: folderId,
  })

  if (error) throw error
  return data ?? []
}

export async function reorderFolders(folderIds) {
  const result = await supabase.auth.getUser()
  if (!result?.data?.user) throw new Error('Non authentifié')

  const user = result.data.user
  const updates = folderIds.map((id, index) => ({
    id,
    position: index,
  }))

  const { error } = await supabase
    .from('folders')
    .upsert(updates)

  if (error) throw error
}
