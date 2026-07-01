// src/lib/albums.js
import { supabase } from "./supabaseClient";

export async function getAlbumsWithVersions() {
  const { data, error } = await supabase
    .from("albums")
    .select(
      `
      id,
      artist,
      title,
      type,
      region,
      release_date,
      album_versions ( id, name, format_description )
    `
    )
    .order("release_date", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((album) => ({
    ...album,
    versions: [...(album.album_versions ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  }));
}