// Awen extension: settings and API calls, shared by the service worker, popup and options.

export const DEFAULT_APP_URL = "https://awen-theta.vercel.app"
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024

export async function getSettings() {
  const { appUrl, token } = await chrome.storage.local.get(["appUrl", "token"])
  return { appUrl: normalizeUrl(appUrl || DEFAULT_APP_URL), token: token || "" }
}

export async function saveSettings({ appUrl, token }) {
  await chrome.storage.local.set({ appUrl: normalizeUrl(appUrl || DEFAULT_APP_URL), token: (token || "").trim() })
}

function normalizeUrl(url) {
  return url.trim().replace(/\/+$/, "")
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

/** Calls the Awen API with the personal token. Throws ApiError with the server's message. */
export async function api(path, { method = "GET", body } = {}) {
  const { appUrl, token } = await getSettings()
  if (!token) throw new ApiError("Configure o token nas opções da extensão.", 401)

  let res
  try {
    res = await fetch(`${appUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(`Não foi possível falar com o Awen em ${appUrl}.`, 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `Erro ${res.status}.`, res.status)
  return data
}

/** { email, activeProject } for the token owner. */
export function getMe() {
  return api("/api/ext/me")
}

/** Saves a page, a link or a video page. Returns { referenceId, project }. */
export function saveLink(url, toProject) {
  return api("/api/ext/references", { method: "POST", body: { kind: "link", url, toProject } })
}

/**
 * Saves an image: the extension downloads it (with the user's cookies, so it works
 * on sites that block server downloads), uploads it straight to storage, and the
 * server derives thumbnail and palette.
 */
export async function saveImage({ srcUrl, pageUrl, pageTitle, toProject }) {
  const { blob, mimeType } = await downloadImage(srcUrl)

  const created = await api("/api/ext/references", {
    method: "POST",
    body: {
      kind: "image",
      mimeType,
      size: blob.size,
      srcUrl: /^https?:/i.test(srcUrl) ? srcUrl : undefined,
      pageUrl: /^https?:/i.test(pageUrl || "") ? pageUrl : undefined,
      pageTitle: pageTitle || undefined,
      toProject,
    },
  })

  await upload(created.upload, blob)
  await api(`/api/ext/references/${created.referenceId}/finalize`, { method: "POST" })
  return created
}

/**
 * Saves someone else's prompt (text selected on a page) with the image it generated,
 * in one entry of the prompt library. Returns { promptId }.
 */
export async function savePromptWithImage({ promptText, srcUrl, pageUrl, pageTitle }) {
  const { blob, mimeType } = await downloadImage(srcUrl)
  const created = await api("/api/ext/prompts", {
    method: "POST",
    body: {
      promptText,
      pageUrl: /^https?:/i.test(pageUrl || "") ? pageUrl : undefined,
      pageTitle: pageTitle || undefined,
      image: { mimeType, size: blob.size },
    },
  })
  await upload(created.upload, blob)
  await api(`/api/ext/prompts/${created.promptId}/assets/${created.assetId}/finalize`, { method: "POST" })
  return created
}

/** Downloads with the user's cookies (works on sites that block server downloads). */
async function downloadImage(srcUrl) {
  let blob
  try {
    const res = await fetch(srcUrl, { credentials: "include" })
    if (!res.ok) throw new Error(String(res.status))
    blob = await res.blob()
  } catch {
    throw new ApiError("Não foi possível baixar esta imagem.", 0)
  }
  if (blob.size > MAX_IMAGE_BYTES) throw new ApiError("A imagem passa de 50 MB.", 413)
  const mimeType = await sniffImageType(blob)
  if (!mimeType) throw new ApiError("Formato de imagem não suportado.", 415)
  return { blob, mimeType }
}

async function upload(target, blob) {
  const put = await fetch(target.url, {
    method: "PUT",
    headers: { "Content-Type": target.contentType },
    body: blob,
  }).catch(() => null)
  if (!put || !put.ok) throw new ApiError("O envio da imagem falhou.", put?.status ?? 0)
}

/** Prompt text kept between the two right-clicks (cleared when the browser closes). */
export async function getPendingPrompt() {
  const { pendingPrompt } = await chrome.storage.session.get("pendingPrompt")
  return pendingPrompt || null
}

export async function setPendingPrompt(pending) {
  if (pending) await chrome.storage.session.set({ pendingPrompt: pending })
  else await chrome.storage.session.remove("pendingPrompt")
}

/** Detects the real image format from its first bytes (CDNs often send a generic type). */
async function sniffImageType(blob) {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to))
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png"
  if (ascii(0, 4) === "GIF8") return "image/gif"
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"
  if (ascii(4, 8) === "ftyp" && /^(avif|avis)$/.test(ascii(8, 12))) return "image/avif"
  return null
}
