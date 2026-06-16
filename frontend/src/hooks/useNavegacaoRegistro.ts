import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Lê a lista de IDs salva pelo grid no sessionStorage e devolve
 * funções de navegação para o registro anterior/próximo.
 *
 * @param chave  Ex: "nav_propostas"
 * @param idAtual  O id do registro sendo visualizado (string ou number)
 * @param basePath  Ex: "/propostas"
 */
export function useNavegacaoRegistro(
  chave: string,
  idAtual: string | number | undefined,
  basePath: string,
  sufixo = '',
) {
  const navigate = useNavigate()

  const ids: number[] = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(chave)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }, [chave])

  const idxAtual = idAtual != null ? ids.indexOf(Number(idAtual)) : -1
  const temAnterior = idxAtual > 0
  const temProximo = idxAtual >= 0 && idxAtual < ids.length - 1
  const total = ids.length
  const posicao = idxAtual >= 0 ? idxAtual + 1 : null

  function irAnterior() {
    if (temAnterior) navigate(`${basePath}/${ids[idxAtual - 1]}${sufixo}`)
  }

  function irProximo() {
    if (temProximo) navigate(`${basePath}/${ids[idxAtual + 1]}${sufixo}`)
  }

  return { temAnterior, temProximo, irAnterior, irProximo, total, posicao }
}

/** Salva a lista de IDs do grid no sessionStorage para navegação */
export function salvarNavegacao(chave: string, ids: number[]) {
  try {
    sessionStorage.setItem(chave, JSON.stringify(ids))
  } catch {
    // sessionStorage indisponível — navegação silenciosamente desabilitada
  }
}
