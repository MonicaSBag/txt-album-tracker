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

## 2026-07-01 — Migración a datos estáticos, Dashboard, gestión de cuenta y pre-deploy

### Contexto
Sesión larga: pasamos de depender de la API de Discogs a un catálogo estático propio, reconstruimos el Dashboard con auth pública + guardado gateado, agregamos gestión de cuenta (dropdown, borrado con email de confirmación) y dejamos todo listo para el primer deploy a Vercel.

### Decisiones tomadas
- **Se abandona Discogs por completo.** Motivo: ruido y duplicados en los datos. El catálogo ahora es un JSON estático curado a mano (25 álbumes / 148 versiones, incluye grupales KR/JP + solos de Yeonjun y Beomgyu).
- **Nuevo esquema de Supabase**: `albums` (id, artist, title, type, region, release_date) + `album_versions` (album_id FK, name, format_description) + `user_collection` (user_id, version_id, PK compuesta). RLS igual que antes: catálogo público de lectura, colección privada por `auth.uid()`.
- **`user_collection` pasó de modelo "flag `owned`" a modelo "presencia = tenencia"**: se hace `insert`/`delete` explícito en vez de `upsert`. La columna `owned` del primer script quedó vestigial (no se usa más).
- **Dashboard vuelve a ser público** (catálogo visible sin login); el login solo se pide al intentar marcar una versión como "Lo tengo" — se descartó la idea de gatear todo el dashboard detrás de auth.
- **Borrado de cuenta**: hard delete inmediato (no soft-delete), justificado porque es una app single-user sin requisitos legales de retención. Se implementa vía Edge Function con service role (`auth.admin.deleteUser`), que además dispara un email de confirmación.
- **Email transaccional vía Resend** (no hay alternativa nativa en Supabase para emails custom). Si `RESEND_API_KEY` no está seteada, el envío se omite sin romper el borrado de cuenta (el fallo de email nunca bloquea la operación principal).
- **Se decidió NO reescribir el historial de Git**: se auditó el repo completo y no hay secretos commiteados nunca, así que un `git filter-repo` sería puro riesgo sin beneficio.

### Estado actual de la app
- `src/App.jsx`: dashboard público con catálogo + colección. Fetch del catálogo en un `useEffect` propio (siempre corre); fetch de la colección del usuario en otro `useEffect` que depende de `user`. Toggle optimista con `pendingIds` para deshabilitar el botón en vuelo, rollback si falla, y toasts de éxito/error (componente propio, sin librerías nuevas). Incluye `UserMenu` (dropdown con email de la cuenta de Google, "Cerrar sesión", "Eliminar cuenta") y `DeleteAccountModal` (requiere escribir "ELIMINAR" para confirmar).
- `src/lib/albums.js`: reescrito para el nuevo esquema (`artist`, `type`, `region`, `release_date`, `format_description`), ordena por `release_date`.
- `src/lib/collection.js`: `getOwnedVersionIds`, `addToCollection` (insert), `removeFromCollection` (delete) — ya no usa `upsert`.
- `src/lib/account.js`: nuevo, invoca la Edge Function `delete-account`.
- `src/lib/discogs.js`, `scripts/seed-discogs.mjs`, `supabase/functions/discogs-proxy/`: **a eliminar** (instrucciones dadas, pendiente de aplicar en el repo real).
- `supabase/functions/delete-account/`: nueva Edge Function. Verifica el JWT del usuario, borra con service role (`auth.admin.deleteUser`), y dispara `sendDeletionEmail` (Resend) con el HTML de `email-template.ts` (paleta dark/violeta-rosa igual a la app). Fallos de email quedan logueados pero no rompen la respuesta.
- `supabase/config.toml`: reescrito para registrar solo `delete-account` (el anterior solo tenía `discogs-proxy`).
- `.gitignore`: se agregó `.env` (plano, no cubierto antes) y `.vercel` (carpeta que genera la CLI de Vercel).
- `vercel.json`: nuevo, con rewrite catch-all a `index.html` (preventivo — hoy la app no tiene rutas propias, pero queda listo si se agregan).

### Variables de entorno / secretos (actualizado)
- `.env.local` (frontend, Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — únicas dos variables a copiar en Vercel.
- Secretos de Edge Functions (vía `supabase secrets set`): `RESEND_API_KEY` (nuevo, requerido para el email de borrado), `EMAIL_FROM` (opcional, default `onboarding@resend.dev`).
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` están disponibles automáticamente dentro de cualquier Edge Function — no hace falta setearlas a mano.
- Ya no existen `DISCOGS_TOKEN` ni `.env.script` (relacionado a Discogs).

### Pendiente / próximos pasos
1. **Aplicar en el repo real** todos los archivos que quedaron generados en esta sesión (borrar carpetas de Discogs, pegar `App.jsx` / `collection.js` / `account.js` nuevos, sumar `supabase/functions/delete-account/`, `supabase/config.toml`, `.gitignore` y `vercel.json` actualizados).
2. Correr el script SQL de reset + carga de datos (`01_reset_schema_y_datos.sql`) en el SQL Editor de Supabase.
3. Crear cuenta en Resend, verificar dominio (o usar `onboarding@resend.dev` en modo test) y setear `RESEND_API_KEY` como secreto.
4. Deployar `delete-account` (`supabase functions deploy delete-account`).
5. `npm install` para limpiar el lockfile (se sacó `dotenv` de `devDependencies`).
6. Conectar el repo a Vercel, pegar las dos env vars de Supabase, deployar.
7. **Inmediatamente después del deploy**: agregar la URL real de Vercel en Supabase → Authentication → URL Configuration (Site URL + Redirect URLs), o el login con Google va a romper igual que pasó con el Codespace.
8. (Opcional, más adelante) Evaluar armar un email de bienvenida para el primer login.
