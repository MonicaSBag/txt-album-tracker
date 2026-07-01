// src/lib/collection.js
import { supabase } from "./supabaseClient";

export async function getOwnedVersionIds(userId) {
  const { data, error } = await supabase
    .from("user_collection")
    .select("version_id")
    .eq("user_id", userId)
    .eq("owned", true);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.version_id));
}

export async function setOwned(userId, versionId, owned) {
  const { error } = await supabase
    .from("user_collection")
    .upsert(
      { user_id: userId, version_id: versionId, owned },
      { onConflict: "user_id,version_id" }
    );
  if (error) throw error;
}