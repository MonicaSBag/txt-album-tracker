# Contexto del Proyecto: TXT Album Tracker PWA

## 1. Estado Actual de la App
- **Tecnología:** Vite + React (JavaScript).
- **Funcionalidades implementadas:** [Aquí Claude irá listando lo que ya funciona, ej: Lista de álbumes, buscador, botones de Tengo/Falta].

## 2. Decisiones de Arquitectura y Diseño
- Estilo visual moderno enfocado a K-Pop / TXT.
- Se prefiere mantener un código limpio y modularizado en componentes dentro de `src/`.
- Prioridad de desarrollo actual: Interfaz de usuario (UI). Próximo paso: Persistencia de datos / PWA.

## 3. Últimos Cambios y Prompts Clave
- **Prompt:** "Modifica src/App.jsx para armar la interfaz de TXT..."
- **Resultado:** Se maquetó la estructura inicial con tarjetas interactivas.

## 2026-06-30 — Setup de datos: Discogs + Supabase

### Contexto
Arrancamos a conectar la PWA (antes con datos hardcodeados en `App.jsx`) a datos reales de Discogs, persistidos en Supabase con auth de usuario.

### Decisiones tomadas
- **Auth**: login exclusivo con Google OAuth vía Supabase Auth (sin email/password por ahora).
- **Seguridad del token de Discogs**: nunca vive en el frontend. Se usa en dos lugares server-side únicamente:
  - Un script local de Node (`scripts/seed-discogs.mjs`) para poblar la base una sola vez.
  - Una Edge Function (`discogs-proxy`) por si en el futuro se necesita hacer búsquedas en vivo desde la UI.
- **Población de datos**: por ahora manual/una sola vez (soy el único usuario). No hay sync automática todavía.
- **RLS**: catálogo (`albums`, `album_versions`) es de lectura pública; `user_collection` está filtrada por `auth.uid()` — cada usuario solo ve/edita su propia colección.

### Estado actual de la app
- `src/App.jsx`: ya no usa datos hardcodeados. Trae álbumes/versiones desde Supabase (`getAlbumsWithVersions`) y el estado "Tengo/Me falta" desde `user_collection` (`getOwnedVersionIds` / `setOwned`), con actualización optimista y rollback si falla el guardado. Muestra skeleton mientras carga, banner de error, y estado vacío si la tabla `albums` no tiene datos todavía.
- `src/hooks/useAuth.js`: maneja sesión de Supabase + login/logout con Google.
- `src/lib/supabaseClient.js`, `src/lib/albums.js`, `src/lib/collection.js`, `src/lib/discogs.js`: capa de acceso a datos.
- `scripts/seed-discogs.mjs`: importa la discografía completa de TXT desde Discogs (masters → versions → detalle de cada release) y hace upsert en Supabase. **Ya corregido** para no duplicar el título del álbum como nombre de versión: ahora usa `formats[].text` del detalle de cada release (`/releases/{id}`) para armar nombres como "Sanctuary Version" / "Arcadia Version" en vez del título genérico repetido.
- Tablas en Supabase: `albums`, `album_versions` (con columna nueva `format_description`), `user_collection`. RLS activo en las tres.

### Variables de entorno
- `.env.local` (frontend, Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `.env.script` (solo local, nunca en git): `DISCOGS_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Secreto en Supabase Edge Functions: `DISCOGS_TOKEN` (vía `supabase secrets set`).

### Pendiente / próximos pasos
- Correr `node scripts/seed-discogs.mjs` con el fix de nombres y verificar con la query de `format_description is null` si quedó alguna versión con nombre poco claro para corregir a mano.
- Registrar los dominios de producción/preview en **Supabase → Authentication → URL Configuration → Redirect URLs** antes de deployar (el login con Google falla si el dominio no está whitelisteado).
- Evaluar si conviene una sync periódica de Discogs más adelante (hoy es manual, a propósito, porque solo hay un usuario).
