// src/lib/collection.js
import { supabase } from "./supabaseClient";

// Trae los version_id que el usuario tiene en su colección.
// La presencia de una fila en user_collection = el usuario tiene esa versión.
export async function getOwnedVersionIds(userId) {
  const { data, error } = await supabase
    .from("user_collection")
    .select("version_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.version_id));
}

// Agrega una versión a la colección del usuario.
export async function addToCollection(userId, versionId) {
  const { error } = await supabase
    .from("user_collection")
    .insert({ user_id: userId, version_id: versionId });
  if (error) throw error;
}

// Quita una versión de la colección del usuario.
export async function removeFromCollection(userId, versionId) {
  const { error } = await supabase
    .from("user_collection")
    .delete()
    .eq("user_id", userId)
    .eq("version_id", versionId);
  if (error) throw error;
}