import { useEffect, useState } from 'react'

// GET /api/setup/logo é público e retorna 404 se não houver logo cadastrada
// (Configurações > Logo da empresa) — nesse caso cai para o quadradinho
// genérico que o CSS já desenha via ::before nos elementos-pai.
export function LogoEmpresa({ alt = 'Logo' }: { alt?: string }) {
  const [temLogo, setTemLogo] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/setup/logo', { method: 'HEAD' })
      .then((r) => setTemLogo(r.ok))
      .catch(() => setTemLogo(false))
  }, [])

  if (!temLogo) return null
  return <img src="/api/setup/logo" alt={alt} className="logo-empresa" />
}
