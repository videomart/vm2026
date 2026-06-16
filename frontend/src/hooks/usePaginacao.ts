import { useCallback, useMemo, useState } from 'react'

export const OPCOES_TAMANHO = [30, 50, 80] as const
export type TamanhoPagina = (typeof OPCOES_TAMANHO)[number] | number

/**
 * Hook único de paginação. Recebe o array já ordenado, gerencia página e
 * tamanho internamente. Expõe `resetar` para ser passado ao useOrdenacao.
 */
export function usePaginacao<T>(itens: T[], tamanhoPadrao: TamanhoPagina = 30) {
  const [pagina, setPagina] = useState(1)
  const [tamanho, setTamanho] = useState<TamanhoPagina>(tamanhoPadrao)

  const totalPaginas = Math.max(1, Math.ceil(itens.length / tamanho))
  const paginaEfetiva = Math.min(pagina, totalPaginas)

  const pagina_atual = useMemo(() => {
    const inicio = (paginaEfetiva - 1) * tamanho
    return itens.slice(inicio, inicio + tamanho)
  }, [itens, paginaEfetiva, tamanho])

  function irPara(p: number) {
    setPagina(Math.max(1, Math.min(p, totalPaginas)))
  }

  function mudarTamanho(t: TamanhoPagina) {
    setTamanho(t)
    setPagina(1)
  }

  // useCallback para identidade estável — pode ser passado ao useOrdenacao
  const resetar = useCallback(() => setPagina(1), [])

  return {
    pagina: paginaEfetiva,
    tamanho,
    totalPaginas,
    total: itens.length,
    pagina_atual,
    irPara,
    mudarTamanho,
    resetar,
  }
}
