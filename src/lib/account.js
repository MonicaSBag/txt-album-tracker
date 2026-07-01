// src/lib/account.js
import { supabase } from "./supabaseClient";

// Invoca la Edge Function que borra al usuario en auth.users.
// supabase-js adjunta automáticamente el access_token de la sesión
// activa como header Authorization, así que no hace falta pasarlo a mano.
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke("delete-account");
  if (error) throw error;
}