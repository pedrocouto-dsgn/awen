// Awen extension service worker: right-click menu, saving, and feedback.

import { getMe, getSettings, saveImage, saveLink } from "./api.js"

const MENU_SAVE = "awen-save"
const MENU_SAVE_PROJECT = "awen-save-project"
const MENU_SETUP = "awen-setup"
const CONTEXTS = ["image", "video", "link", "page"]

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("refresh-menus", { periodInMinutes: 15 })
  void refreshMenus()
})
chrome.runtime.onStartup.addListener(() => void refreshMenus())
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refresh-menus") void refreshMenus()
})
chrome.storage.onChanged.addListener((changes) => {
  if (changes.appUrl || changes.token) void refreshMenus()
})

// The popup asks for a refresh when it opens (the active project may have changed).
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "refresh-menus") {
    refreshMenus().then(sendResponse)
    return true
  }
  if (message?.type === "save-page") {
    saveTarget({ kind: "link", url: message.url }, message.toProject).then(sendResponse)
    return true
  }
  return false
})

let menuQueue = Promise.resolve(null)

/** Rebuilds run one after another, so overlapping calls cannot create duplicate items. */
function refreshMenus() {
  menuQueue = menuQueue.then(buildMenus, buildMenus)
  return menuQueue
}

/**
 * Rebuilds the menu: "Salvar no Awen", plus "Salvar no projeto: …" when a project
 * is active. Without a working token, a single item opens the options.
 */
async function buildMenus() {
  let me = null
  const { token } = await getSettings()
  if (token) me = await getMe().catch(() => null)

  await chrome.contextMenus.removeAll()
  if (!me) {
    chrome.contextMenus.create({ id: MENU_SETUP, title: "Configurar o Awen…", contexts: CONTEXTS })
    return me
  }
  if (me.activeProject) {
    chrome.contextMenus.create({ id: "awen", title: "Awen", contexts: CONTEXTS })
    chrome.contextMenus.create({ id: MENU_SAVE, parentId: "awen", title: "Salvar no Awen", contexts: CONTEXTS })
    chrome.contextMenus.create({
      id: MENU_SAVE_PROJECT,
      parentId: "awen",
      title: `Salvar no projeto: ${me.activeProject.name}`,
      contexts: CONTEXTS,
    })
  } else {
    chrome.contextMenus.create({ id: MENU_SAVE, title: "Salvar no Awen", contexts: CONTEXTS })
  }
  return me
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_SETUP) {
    chrome.runtime.openOptionsPage()
    return
  }
  if (info.menuItemId !== MENU_SAVE && info.menuItemId !== MENU_SAVE_PROJECT) return
  void saveTarget(targetFor(info, tab), info.menuItemId === MENU_SAVE_PROJECT)
})

/** What to save for a right-click: the image itself, or a link/page URL. */
function targetFor(info, tab) {
  const pageUrl = info.pageUrl || tab?.url
  const pageTitle = tab?.title
  if (info.mediaType === "image" && info.srcUrl && !info.srcUrl.startsWith("blob:")) {
    return { kind: "image", srcUrl: info.srcUrl, pageUrl, pageTitle }
  }
  // Videos are saved as their page: YouTube/Vimeo embed, other sites keep the preview and link.
  if (info.mediaType === "video") return { kind: "link", url: pageUrl }
  if (info.linkUrl) return { kind: "link", url: info.linkUrl }
  return { kind: "link", url: pageUrl }
}

async function saveTarget(target, toProject) {
  setBadge("…", "#4B708D")
  try {
    let result
    if (target.kind === "image") {
      try {
        result = await saveImage({ ...target, toProject })
      } catch (error) {
        // Some images cannot be downloaded (expired or protected URLs): keep at least the page.
        if (!target.pageUrl || error.status === 401) throw error
        result = await saveLink(target.pageUrl, toProject)
      }
    } else {
      if (!target.url || !/^https?:/i.test(target.url)) throw new Error("Esta página não pode ser salva.")
      result = await saveLink(target.url, toProject)
    }
    setBadge("✓", "#2E7D5B")
    notify(result.project ? `Salvo no projeto ${result.project.name}.` : "Salvo no Awen. A análise começa em seguida.")
    return { ok: true, project: result.project }
  } catch (error) {
    setBadge("!", "#B3261E")
    notify(error.message || "Não foi possível salvar.", true)
    if (error.status === 401) void refreshMenus()
    return { ok: false, error: error.message }
  }
}

function setBadge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color })
  chrome.action.setBadgeText({ text })
  if (text !== "…") setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000)
}

function notify(message, isError = false) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/128.png",
    title: isError ? "Awen: não foi possível salvar" : "Awen",
    message,
  })
}
