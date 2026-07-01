// src/lib/albums.js
import { supabase } from "./supabaseClient";

export async function getAlbumsWithVersions() {
  const { data, error } = await supabase
    .from("albums")
    .select(
      `
      id,
      title,
      era,
      release_year,
      cover_url,
      album_versions ( id, name, format, country, year, cover_url )
    `
    )
    .order("release_year", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((album) => ({
    ...album,
    versions: [...(album.album_versions ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  }));
}