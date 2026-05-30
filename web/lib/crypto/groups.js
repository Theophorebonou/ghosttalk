import { deriveSharedKey, encryptMessage, decryptMessage } from './e2e'
import { base64ToBuf, bufToBase64 } from './keys'

/**
 * Chiffre un message pour un groupe (pour chaque membre)
 * Retourne un tableau de ciphertexts, un par membre
 */
export async function encryptForGroup(sharedKey, plaintext) {
  // Pour simplifier, on utilise la même clé partagée pour tout le groupe
  // Dans une implémentation plus avancée, on utiliserait un schéma de chiffrement de groupe
  // comme Signal's Double Ratchet ou MLS (Messaging Layer Security)
  return await encryptMessage(sharedKey, plaintext)
}

/**
 * Déchiffre un message de groupe
 */
export async function decryptFromGroup(sharedKey, ciphertext) {
  return await decryptMessage(sharedKey, ciphertext)
}

/**
 * Pour une implémentation plus robuste de groupes, on pourrait:
 * 1. Utiliser une clé de groupe symétrique
 * 2. Distribuer cette clé à chaque membre via E2E individuel
 * 3. Re-chiffrer la clé de groupe quand un membre quitte
 * 
 * Pour l'instant, on utilise une approche simplifiée où chaque membre
 * dérive une clé partagée avec chaque autre membre (mesh encryption)
 */
