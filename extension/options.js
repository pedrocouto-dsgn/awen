import { getMe, getSettings, saveSettings } from "./api.js"

const form = document.getElementById("form")
const appUrl = document.getElementById("app-url")
const token = document.getElementById("token")
const status = document.getElementById("status")

const settings = await getSettings()
appUrl.value = settings.appUrl
token.value = settings.token

form.addEventListener("submit", async (e) => {
  e.preventDefault()
  status.className = "status"
  status.textContent = "Testando…"
  await saveSettings({ appUrl: appUrl.value, token: token.value })
  try {
    const me = await getMe()
    status.className = "status ok"
    status.textContent = `Conectado como ${me.email ?? "você"}${me.activeProject ? ` · projeto ativo: ${me.activeProject.name}` : ""}.`
  } catch (error) {
    status.className = "status error"
    status.textContent = error.message
  }
})
