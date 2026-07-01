// scripts/seed-discogs.mjs
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.script" });

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const USER_AGENT = "TXTAlbumTracker/1.0 +https://github.com/tu-usuario/txt-album-tracker";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function discogsFetch(path, params = {}) {
  const url = new URL(`https://api.discogs.com${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `Discogs token=${DISCOGS_TOKEN}`,
    },
  });

  if (res.status === 429) {
    console.log("Rate limit alcanzado, esperando 60s...");
    await sleep(60_000);
    return discogsFetch(path, params);
  }
  if (!res.ok) throw new Error(`Discogs ${res.status}: ${await res.text()}`);
  return res.json();
}

async function findArtistId() {
  const result = await discogsFetch("/database/search", {
    q: "Tomorrow X Together",
    type: "artist",
  });
  const match = result.results?.[0];
  if (!match) throw new Error("No se encontró el artista en Discogs");
  console.log(`Artista encontrado: ${match.title} (id ${match.id})`);
  return match.id;
}

// NUEVO: el listado de versiones no trae el descriptor real
// (Sanctuary / Arcadia / Ethereal, etc). Ese dato vive en formats[].text
// dentro del detalle completo de cada release.
function extractFormatText(fullRelease) {
  const texts = (fullRelease.formats ?? [])
    .map((f) => f.text?.trim())
    .filter(Boolean);
  return texts.length > 0 ? [...new Set(texts)].join(" / ") : null;
}

function buildVersionName({ basicVersion, fullRelease, masterTitle }) {
  const formatText = extractFormatText(fullRelease);

  if (formatText) {
    return /vers(i[oó]n|\.)/i.test(formatText) ? formatText : `${formatText} Ver.`;
  }

  // Si Discogs no trae texto de formato, pero el título de la versión
  // ya es distinto al del master, usamos ese
  if (basicVersion.title && basicVersion.title.trim() !== masterTitle.trim()) {
    return basicVersion.title.trim();
  }

  // Último recurso: formato básico + catálogo, para no repetir el mismo nombre
  const basicFormat = basicVersion.format || "Edición";
  return `${basicFormat} (${basicVersion.catno || basicVersion.id})`;
}

async function seed() {
  const artistId = process.env.DISCOGS_ARTIST_ID || (await findArtistId());

  let releasesPage = 1;
  const masterIds = new Set();

  while (true) {
    const data = await discogsFetch(`/artists/${artistId}/releases`, {
      page: releasesPage,
      per_page: 100,
      sort: "year",
      sort_order: "asc",
    });

    for (const release of data.releases ?? []) {
      if (release.type === "master" && release.role === "Main") {
        masterIds.add(release.id);
      }
    }

    if (releasesPage >= data.pagination.pages) break;
    releasesPage++;
    await sleep(1100);
  }

  console.log(`Encontrados ${masterIds.size} álbumes (masters).`);

  for (const masterId of masterIds) {
    await sleep(1100);
    const master = await discogsFetch(`/masters/${masterId}`);

    console.log(`→ ${master.title} (${master.year})`);

    const { data: album, error: albumError } = await supabase
      .from("albums")
      .upsert(
        {
          discogs_master_id: masterId,
          title: master.title,
          era: String(master.year),
          release_year: master.year,
          cover_url: master.images?.[0]?.uri ?? null,
        },
        { onConflict: "discogs_master_id" }
      )
      .select()
      .single();

    if (albumError) {
      console.error(`  Error guardando álbum: ${albumError.message}`);
      continue;
    }

    await sleep(1100);
    const versions = await discogsFetch(`/masters/${masterId}/versions`, {
      per_page: 100,
    });

    for (const v of versions.versions ?? []) {
      // Fetch extra: necesitamos el detalle completo del release
      // para llegar a formats[].text (el descriptor real de la edición)
      await sleep(1100);
      let fullRelease;
      try {
        fullRelease = await discogsFetch(`/releases/${v.id}`);
      } catch (err) {
        console.error(`    No se pudo obtener detalle de release ${v.id}: ${err.message}`);
        continue;
      }

      const name = buildVersionName({
        basicVersion: v,
        fullRelease,
        masterTitle: master.title,
      });

      const { error: versionError } = await supabase.from("album_versions").upsert(
        {
          album_id: album.id,
          discogs_release_id: v.id,
          name,
          format: Array.isArray(v.format) ? v.format.join(", ") : v.format,
          format_description: extractFormatText(fullRelease),
          country: v.country,
          year: v.released ? parseInt(v.released, 10) : null,
          cover_url: v.thumb || null,
        },
        { onConflict: "discogs_release_id" }
      );

      if (versionError) {
        console.error(`    Error en versión "${name}": ${versionError.message}`);
      } else {
        console.log(`    + ${name}`);
      }
    }
  }

  console.log("Seed completo.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});