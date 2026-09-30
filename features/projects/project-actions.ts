export async function setProjectActive(id: string, active: boolean) {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: active }),
  })
  if (!res.ok) throw new Error("Não foi possível alterar o projeto ativo.")
}

export async function deleteProject(id: string) {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Não foi possível excluir o projeto.")
}
