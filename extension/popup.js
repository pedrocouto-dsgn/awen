import { getMe, getSettings } from "./api.js"

const account = document.getElementById("account")
const savePage = document.getElementById("save-page")
const saveProject = document.getElementById("save-page-project")
const status = document.getElementById("status")

document.getElementById("options").addEventListener("click", (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})
document.getElementById("open-app").addEventListener("click", async (e) => {
  e.preventDefault()
  const { appUrl } = await getSettings()
  chrome.tabs.create({ url: `${appUrl}/library` })
})

function showStatus(text, kind) {
  status.textContent = text
  status.className = `status ${kind ?? ""}`
}

async function save(toProject) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  savePage.disabled = saveProject.disabled = true
  showStatus("Salvando…")
  const result = await chrome.runtime.sendMessage({ type: "save-page", url: tab?.url, toProject })
  savePage.disabled = saveProject.disabled = false
  if (result?.ok) showStatus(result.project ? `Salvo no projeto ${result.project.name}.` : "Salvo no Awen.", "ok")
  else showStatus(result?.error ?? "Não foi possível salvar.", "error")
}

savePage.addEventListener("click", () => void save(false))
saveProject.addEventListener("click", () => void save(true))

async function init() {
  const { token } = await getSettings()
  if (!token) {
    account.innerHTML = '<p>Configure o token para começar.</p>'
    const button = document.createElement("button")
    button.textContent = "Abrir opções"
    button.addEventListener("click", () => chrome.runtime.openOptionsPage())
    account.append(button)
    return
  }
  try {
    const me = await getMe()
    account.replaceChildren(
      line("Conta", me.email ?? "—"),
      line("Projeto ativo", me.activeProject?.name ?? "nenhum"),
    )
    savePage.disabled = false
    if (me.activeProject) {
      saveProject.hidden = false
      saveProject.textContent = `Salvar no projeto ${me.activeProject.name}`
    }
    // Keep the right-click menu in sync with the active project.
    void chrome.runtime.sendMessage({ type: "refresh-menus" })
  } catch (error) {
    account.innerHTML = ""
    const p = document.createElement("p")
    p.className = "status error"
    p.textContent = error.message
    account.append(p)
  }
}

function line(label, value) {
  const p = document.createElement("p")
  const span = document.createElement("span")
  span.className = "muted"
  span.textContent = `${label}: `
  p.append(span, value)
  return p
}

void init()
