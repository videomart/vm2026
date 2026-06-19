import { useEffect, useState } from 'react'

// GET /api/setup/logo/interface é público e retorna 404 se não houver logo
// cadastrada (Configurações > Logo da interface) — nesse caso cai para o
// quadradinho genérico que o CSS já desenha via ::before nos elementos-pai.
// Variante separada da logo_base64 usada no PDF (fundo branco): a interface
// tem fundo escuro, então a maioria das logos precisa de uma versão diferente
// para ter contraste adequado.
export function LogoEmpresa({ alt = 'Logo' }: { alt?: string }) {
  const [temLogo, setTemLogo] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/setup/logo/interface', { method: 'HEAD' })
      .then((r) => setTemLogo(r.ok))
      .catch(() => setTemLogo(false))
  }, [])

  if (!temLogo) return null
  return <img src="/api/setup/logo/interface" alt={alt} className="logo-empresa" />
}
