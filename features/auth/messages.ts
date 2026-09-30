/** Maps Supabase Auth errors to pt-BR messages without leaking internals. */
export function authErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase()
  if (m.includes("invalid login credentials")) return "Email ou senha incorretos."
  if (m.includes("email not confirmed")) return "Este email ainda não foi confirmado."
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos."
  if (m.includes("same password") || m.includes("different from the old")) return "A nova senha precisa ser diferente da atual."
  if (m.includes("weak") || m.includes("password should")) return "Senha fraca. Use pelo menos 8 caracteres, com letras e números."
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "Link expirado ou inválido. Peça um novo."
  return "Algo deu errado. Tente novamente."
}
