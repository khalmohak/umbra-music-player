const VERSION = "1.16.0";
const CLIENT_ID = "audio-listener";

export type SubsonicPingOk = {
  status: "ok";
  version?: string;
  type?: string;
  serverVersion?: string;
  openSubsonic?: boolean;
};

export type SubsonicErrorBody = {
  status: "failed";
  error?: { code?: number; message?: string };
};

export type SubsonicEnvelope<T> = {
  "subsonic-response": T & { status: string };
};

function qs(
  user: string,
  pass: string,
  extra: Record<string, string> = {}
): string {
  const p = new URLSearchParams({
    u: user,
    p: pass,
    v: VERSION,
    c: CLIENT_ID,
    f: "json",
  });
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

export function asArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export async function ping(user: string, pass: string) {
  const res = await fetch(`/rest/ping.view?${qs(user, pass)}`);
  const data = (await res.json()) as SubsonicEnvelope<
    SubsonicPingOk | SubsonicErrorBody
  >;
  return data["subsonic-response"];
}

export type ArtistIndex = {
  name?: string;
  artist?: { id: string; name: string }[];
};

export async function getArtists(user: string, pass: string) {
  const res = await fetch(`/rest/getArtists.view?${qs(user, pass)}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    artists?: { index?: ArtistIndex[] };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export function countArtists(artists: { index?: ArtistIndex[] } | undefined) {
  const idx = artists?.index ?? [];
  let n = 0;
  for (const block of idx) {
    n += block.artist?.length ?? 0;
  }
  return n;
}

export type ArtistListEntry = { id: string; name: string };

export function flattenArtistList(
  body: Awaited<ReturnType<typeof getArtists>>
): ArtistListEntry[] {
  if (body.status !== "ok" || !body.artists?.index) return [];
  const out: ArtistListEntry[] = [];
  for (const block of body.artists.index) {
    for (const a of asArray(block.artist)) {
      if (a?.id && a?.name) out.push({ id: a.id, name: a.name });
    }
  }
  out.sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: "base" }));
  return out;
}

export type ArtistAlbumEntry = {
  id: string;
  name: string;
  artist?: string;
  coverArt?: string;
  year?: number | string;
};

export type ArtistDetailPayload = {
  id: string;
  name: string;
  coverArt?: string;
  albumCount?: number;
  album?: ArtistAlbumEntry | ArtistAlbumEntry[];
};

export async function getArtist(user: string, pass: string, artistId: string) {
  const res = await fetch(
    `/rest/getArtist.view?${qs(user, pass, { id: artistId })}`
  );
  const data = (await res.json()) as SubsonicEnvelope<{
    artist?: ArtistDetailPayload;
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export function normalizeArtistAlbums(artist: ArtistDetailPayload | undefined) {
  if (!artist?.album) return [];
  return asArray(artist.album);
}

export type ArtistInfo2Payload = {
  biography?: string;
  largeImageUrl?: string;
  mediumImageUrl?: string;
  smallImageUrl?: string;
  similarArtist?: { id: string; name: string } | { id: string; name: string }[];
};

export async function getArtistInfo2(user: string, pass: string, artistId: string) {
  const res = await fetch(
    `/rest/getArtistInfo2.view?${qs(user, pass, { id: artistId, count: "12" })}`
  );
  const data = (await res.json()) as SubsonicEnvelope<{
    artistInfo2?: ArtistInfo2Payload;
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export type PlaylistEntry = {
  id: string;
  name: string;
  songCount?: number;
  duration?: number;
  created?: string;
  public?: boolean;
};

export type PlaylistSong = {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  coverArt?: string;
  duration?: number;
  track?: number;
  bitRate?: number;
  suffix?: string;
  transcodedSuffix?: string;
  samplingRate?: number;
  bitDepth?: number;
  size?: number;
  replayGain?: ReplayGainInfo;
};

export type PlaylistDetail = PlaylistEntry & {
  entry?: PlaylistSong | PlaylistSong[];
};

export async function getPlaylist(user: string, pass: string, playlistId: string) {
  const res = await fetch(`/rest/getPlaylist.view?${qs(user, pass, { id: playlistId })}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    playlist?: PlaylistDetail;
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export async function createPlaylist(
  user: string,
  pass: string,
  name: string,
  songIds: string[] = []
) {
  const p = new URLSearchParams({ u: user, p: pass, v: VERSION, c: CLIENT_ID, f: "json", name });
  for (const id of songIds) p.append("songId", id);
  const res = await fetch(`/rest/createPlaylist.view?${p.toString()}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    playlist?: PlaylistDetail;
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export async function updatePlaylist(
  user: string,
  pass: string,
  playlistId: string,
  opts: {
    name?: string;
    comment?: string;
    isPublic?: boolean;
    songIdsToAdd?: string[];
    songIndicesToRemove?: number[];
  }
) {
  const p = new URLSearchParams({ u: user, p: pass, v: VERSION, c: CLIENT_ID, f: "json", playlistId });
  if (opts.name != null) p.set("name", opts.name);
  if (opts.comment != null) p.set("comment", opts.comment);
  if (opts.isPublic != null) p.set("public", String(opts.isPublic));
  for (const id of opts.songIdsToAdd ?? []) p.append("songIdToAdd", id);
  for (const idx of opts.songIndicesToRemove ?? []) p.append("songIndexToRemove", String(idx));
  const res = await fetch(`/rest/updatePlaylist.view?${p.toString()}`);
  const data = (await res.json()) as SubsonicEnvelope<{ error?: { code?: number; message?: string } }>;
  return data["subsonic-response"];
}

export async function deletePlaylist(user: string, pass: string, playlistId: string) {
  const res = await fetch(`/rest/deletePlaylist.view?${qs(user, pass, { id: playlistId })}`);
  const data = (await res.json()) as SubsonicEnvelope<{ error?: { code?: number; message?: string } }>;
  return data["subsonic-response"];
}

export async function getPlaylists(user: string, pass: string) {
  const res = await fetch(`/rest/getPlaylists.view?${qs(user, pass)}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    playlists?: { playlist?: PlaylistEntry | PlaylistEntry[] };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export function normalizePlaylists(
  body: Awaited<ReturnType<typeof getPlaylists>>
): PlaylistEntry[] {
  if (body.status !== "ok" || !body.playlists?.playlist) return [];
  return asArray(body.playlists.playlist);
}

export async function getAlbumList2(
  user: string,
  pass: string,
  params: { type: string; size: number; offset?: number; genre?: string }
) {
  const extra: Record<string, string> = {
    type: params.type,
    size: String(params.size),
  };
  if (params.offset != null) extra.offset = String(params.offset);
  if (params.genre != null) extra.genre = params.genre;
  const res = await fetch(`/rest/getAlbumList2.view?${qs(user, pass, extra)}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    albumList2?: {
      album?: AlbumSummary[];
    };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export function normalizeAlbums(
  body: Awaited<ReturnType<typeof getAlbumList2>>
) {
  if (body.status !== "ok" || !body.albumList2?.album) return [];
  return asArray(body.albumList2.album);
}

export type AlbumSummary = {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  year?: number;
  genre?: string;
  playCount?: number;
  lastPlayed?: string;
  userRating?: number;
  averageRating?: number;
};

export type SearchArtist = {
  id: string;
  name: string;
  coverArt?: string;
  albumCount?: number;
};

export type SearchSong = {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  coverArt?: string;
  duration?: number;
  track?: number;
  bitRate?: number;
  suffix?: string;
  transcodedSuffix?: string;
  samplingRate?: number;
  bitDepth?: number;
};

export async function search3(
  user: string,
  pass: string,
  query: string,
  opts?: {
    albumCount?: number;
    albumOffset?: number;
    artistCount?: number;
    artistOffset?: number;
    songCount?: number;
    songOffset?: number;
  }
) {
  const extra: Record<string, string> = {
    query,
    artistCount: String(opts?.artistCount ?? 0),
    albumCount: String(opts?.albumCount ?? 12),
    songCount: String(opts?.songCount ?? 0),
  };
  if (opts?.albumOffset) extra.albumOffset = String(opts.albumOffset);
  if (opts?.artistOffset) extra.artistOffset = String(opts.artistOffset);
  if (opts?.songOffset) extra.songOffset = String(opts.songOffset);
  const res = await fetch(`/rest/search3.view?${qs(user, pass, extra)}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    searchResult3?: {
      artist?: SearchArtist | SearchArtist[];
      album?: AlbumSummary | AlbumSummary[];
      song?: SearchSong | SearchSong[];
    };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export function normalizeSearchAlbums(
  body: Awaited<ReturnType<typeof search3>>
): AlbumSummary[] {
  if (body.status !== "ok" || !body.searchResult3?.album) return [];
  return asArray(body.searchResult3.album);
}

export function normalizeSearchArtists(
  body: Awaited<ReturnType<typeof search3>>
): SearchArtist[] {
  if (body.status !== "ok" || !body.searchResult3?.artist) return [];
  return asArray(body.searchResult3.artist);
}

export function normalizeSearchSongs(
  body: Awaited<ReturnType<typeof search3>>
): SearchSong[] {
  if (body.status !== "ok" || !body.searchResult3?.song) return [];
  return asArray(body.searchResult3.song);
}

export type ReplayGainInfo = {
  trackGain?: number;
  albumGain?: number;
  trackPeak?: number;
  albumPeak?: number;
  baseGain?: number;
};

export type AlbumSong = {
  id: string;
  title: string;
  duration?: number;
  track?: number;
  artist?: string;
  bitRate?: number;
  suffix?: string;
  contentType?: string;
  transcodedSuffix?: string;
  transcodedContentType?: string;
  samplingRate?: number;
  bitDepth?: number;
  channelCount?: number;
  size?: number;
  replayGain?: ReplayGainInfo;
};

export type AlbumDetailPayload = {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  year?: number | string;
  genre?: string;
  duration?: number;
  song?: AlbumSong | AlbumSong[];
};

export async function getAlbum(user: string, pass: string, albumId: string) {
  const res = await fetch(
    `/rest/getAlbum.view?${qs(user, pass, { id: albumId })}`
  );
  const data = (await res.json()) as SubsonicEnvelope<{
    album?: AlbumDetailPayload;
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export function normalizeAlbumSongs(album: AlbumDetailPayload | undefined) {
  if (!album?.song) return [];
  return asArray(album.song);
}

export function coverArtUrl(
  user: string,
  pass: string,
  coverOrId: string | undefined,
  size = 200
) {
  const id = coverOrId;
  if (!id) return "";
  const p = new URLSearchParams({
    u: user,
    p: pass,
    v: VERSION,
    c: CLIENT_ID,
    id,
    size: String(size),
  });
  return `/rest/getCoverArt.view?${p.toString()}`;
}

export function streamUrl(
  user: string,
  pass: string,
  songId: string,
  opts?: { maxBitRate?: number }
) {
  const p = new URLSearchParams({
    u: user,
    p: pass,
    v: VERSION,
    c: CLIENT_ID,
    id: songId,
  });
  if (opts?.maxBitRate != null) {
    p.set("maxBitRate", String(opts.maxBitRate));
  }
  return `/rest/stream.view?${p.toString()}`;
}

export type RadioSong = {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  coverArt?: string;
  duration?: number;
  bitRate?: number;
  suffix?: string;
  transcodedSuffix?: string;
  samplingRate?: number;
  bitDepth?: number;
  size?: number;
  replayGain?: ReplayGainInfo;
};

export async function getSimilarSongs2(
  user: string,
  pass: string,
  artistId: string,
  count = 50
) {
  const res = await fetch(
    `/rest/getSimilarSongs2.view?${qs(user, pass, { id: artistId, count: String(count) })}`
  );
  const data = (await res.json()) as SubsonicEnvelope<{
    similarSongs2?: { song?: RadioSong | RadioSong[] };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export async function getTopSongs(
  user: string,
  pass: string,
  artistName: string,
  count = 10
) {
  const res = await fetch(
    `/rest/getTopSongs.view?${qs(user, pass, { artist: artistName, count: String(count) })}`
  );
  const data = (await res.json()) as SubsonicEnvelope<{
    topSongs?: { song?: RadioSong | RadioSong[] };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export async function star(
  user: string,
  pass: string,
  opts: { id?: string; albumId?: string; artistId?: string }
) {
  const extra: Record<string, string> = {};
  if (opts.id) extra.id = opts.id;
  if (opts.albumId) extra.albumId = opts.albumId;
  if (opts.artistId) extra.artistId = opts.artistId;
  await fetch(`/rest/star.view?${qs(user, pass, extra)}`);
}

export async function unstar(
  user: string,
  pass: string,
  opts: { id?: string; albumId?: string; artistId?: string }
) {
  const extra: Record<string, string> = {};
  if (opts.id) extra.id = opts.id;
  if (opts.albumId) extra.albumId = opts.albumId;
  if (opts.artistId) extra.artistId = opts.artistId;
  await fetch(`/rest/unstar.view?${qs(user, pass, extra)}`);
}

export type StarredSong = {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  coverArt?: string;
  duration?: number;
  starred?: string;
};

export type StarredAlbum = {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  starred?: string;
};

export type StarredArtist = {
  id: string;
  name: string;
  coverArt?: string;
  starred?: string;
};

export async function getStarred2(user: string, pass: string) {
  const res = await fetch(`/rest/getStarred2.view?${qs(user, pass)}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    starred2?: {
      song?: StarredSong | StarredSong[];
      album?: StarredAlbum | StarredAlbum[];
      artist?: StarredArtist | StarredArtist[];
    };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export type Genre = {
  value: string;
  songCount: number;
  albumCount: number;
};

export async function getGenres(user: string, pass: string) {
  const res = await fetch(`/rest/getGenres.view?${qs(user, pass)}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    genres?: { genre?: Genre | Genre[] };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}

export async function getLicense(user: string, pass: string) {
  const res = await fetch(`/rest/getLicense.view?${qs(user, pass)}`);
  const data = (await res.json()) as SubsonicEnvelope<{
    license?: { valid?: boolean; email?: string };
    error?: { code?: number; message?: string };
  }>;
  return data["subsonic-response"];
}
