import { ProviderError } from './retry'

/**
 * Cliente GraphQL mínimo para Buffer (fetch directo, sin SDK — la doc dice que no hace falta).
 *
 * Formato de assets VERIFICADO por introspection del schema real de Buffer (la doc pública
 * estaba desactualizada): `assets: [AssetInput!]`, donde cada AssetInput para imagen es
 * `{ image: { url } }` (ImageAssetInput.url es String!). NO es `{ url, type }` como decía la
 * doc, ni el `assets:{images:[{url}]}` viejo de Socialia.
 *
 * Buffer NO acepta upload directo de archivo: la media debe ser una URL pública. La de
 * Cloudinary (Fase A/C) sirve tal cual.
 */

const ENDPOINT = 'https://api.buffer.com'

// IDs confirmados de la cuenta Buffer de ActivoPOS (no son secretos; la API key sí).
export const BUFFER_ORG_ID     = '6a5721bec42babc842adff34'
export const BUFFER_IG_CHANNEL = '6a5721ed80cc80cdcab9209c'
export const BUFFER_FB_CHANNEL = '6a5730b680cc80cdcab9804d'

export const BUFFER_CHANNELS = {
  instagram: BUFFER_IG_CHANNEL,
  facebook:  BUFFER_FB_CHANNEL,
} as const

export type BufferChannelName = keyof typeof BUFFER_CHANNELS

// CreatePostInput.channelId es un SCALAR NON_NULL (verificado por introspection
// real del schema de Buffer, no acepta lista) — publicar a varios canales
// requiere una mutation createPost independiente por canal, nunca un array en
// la misma llamada. Ver publish/route.ts para el loop multi-canal.

interface GraphQLResponse<T> {
  data?:   T
  errors?: { message: string }[]
}

async function callBuffer<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = process.env.BUFFER_API_KEY
  if (!key) throw new ProviderError('BUFFER_API_KEY no configurada en el servidor', 500)

  const res = await fetch(ENDPOINT, {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query, variables }),
  })

  const body = await res.json() as GraphQLResponse<T>
  if (!res.ok || body.errors?.length) {
    throw new ProviderError(`Buffer: ${body.errors?.[0]?.message ?? res.statusText}`, res.status || 502)
  }
  if (!body.data) throw new ProviderError('Buffer devolvió respuesta vacía', 502)
  return body.data
}

// ── createPost ───────────────────────────────────────────────────────────────

export interface CreatePostInput {
  channelId: string
  text:      string
  /** Una o más imágenes (carrusel). En orden: la primera es la portada. */
  imageUrls: string[]
  /** Instagram exige el tipo en metadata. Default 'post'. */
  igType?:   'post' | 'story' | 'reel'
  /** ISO 8601 UTC. Si viene, se programa (customScheduled); si no, addToQueue. */
  dueAt?:    string
}

interface CreatePostResult {
  createPost: {
    post?:    { id: string; dueAt?: string | null; status?: string }
    message?: string
  }
}

export async function createPost(input: CreatePostInput): Promise<{ id: string; status?: string }> {
  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id dueAt status } }
        ... on MutationError { message }
      }
    }`

  // metadata es channel-scoped (PostInputMetaData.instagram / .facebook son objetos
  // distintos, verificado por introspection) — mandar el bloque equivocado para el
  // channelId real, aunque Buffer probablemente lo ignore, no es correcto. Se arma
  // solo el bloque del canal que realmente se está publicando.
  const metadata = input.channelId === BUFFER_FB_CHANNEL
    ? { facebook: { type: input.igType ?? 'post' } }
    : { instagram: { type: input.igType ?? 'post', shouldShareToFeed: true } }

  const postInput: Record<string, unknown> = {
    channelId:      input.channelId,
    text:           input.text,
    schedulingType: 'automatic',
    assets:         input.imageUrls.map(url => ({ image: { url } })),
    metadata,
    ...(input.dueAt
      ? { mode: 'customScheduled', dueAt: input.dueAt }
      : { mode: 'addToQueue' }),
  }

  const data = await callBuffer<CreatePostResult>(mutation, { input: postInput })
  const cp   = data.createPost
  if (cp.message || !cp.post) {
    throw new ProviderError(`Buffer rechazó el post: ${cp.message ?? 'sin post en la respuesta'}`, 422)
  }
  return { id: cp.post.id, status: cp.post.status }
}

// ── verificación ──────────────────────────────────────────────────────────────

export interface QueuedPost {
  id:     string
  text:   string
  dueAt:  string | null
  status: string
}

export async function getPostsByChannel(channelId: string, first = 20): Promise<QueuedPost[]> {
  const query = `
    query PostsByChannel($first: Int!, $input: PostsInput!) {
      posts(first: $first, input: $input) {
        edges { node { id text dueAt status } }
      }
    }`

  const data = await callBuffer<{ posts: { edges: { node: QueuedPost }[] } }>(query, {
    first,
    input: { organizationId: BUFFER_ORG_ID, filter: { channelIds: [channelId] } },
  })
  return data.posts.edges.map(e => e.node)
}
