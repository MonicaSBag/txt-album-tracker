// src/lib/discogs.js
import { supabase } from "./supabaseClient";

export async function searchDiscogsArtist(query) {
  const { data, error } = await supabase.functions.invoke("discogs-proxy", {
    body: {
      path: "/database/search",
      params: { q: query, type: "master", per_page: 20 },
    },
  });
  if (error) throw error;
  return data;
}

export async function getMasterVersions(masterId) {
  const { data, error } = await supabase.functions.invoke("discogs-proxy", {
    body: { path: `/masters/${masterId}/versions` },
  });
  if (error) throw error;
  return data;
}