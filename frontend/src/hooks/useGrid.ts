import { useCallback, useMemo, useState } from 'react'

export const OPCOES_TAMANHO = [30, 50, 80] as const
export type TamanhoPagina = (typeof OPCOES_TAMANHO)[number] | number
export type Direcao = 'asc' | 'desc'

/**
 * Hook único que combina ordenação + paginação para um grid.
 * Passa apenas `itens` (o array completo) e ele devolve:
 *   - `pagina_atual`: fatia a renderizar
 *   - `th(col)`: props do <th> (classe + onClick)
 *   - controles de paginação
 */
export function useGrid<T>(itens: T[], colunaInicial?: keyof T, tamanhoPadrao: TamanhoPagina = 30, direcaoInicial: Direcao = 'asc') {
  const [coluna, setColuna] = useState<keyof T | null>(colunaInicial ?? null)
  const [direcao, setDirecao] = useState<Direcao>(direcaoInicial)
  const [pagina, setPagina] = useState(1)
  const [tamanho, setTamanho] = useState<TamanhoPagina>(tamanhoPadrao)

  const ordenados = useMemo(() => {
    if (!coluna) return itens
    return [...itens].sort((a, b) => {
      const va = a[coluna]
      const vb = b[coluna]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
      return direcao === 'asc' ? cmp : -cmp
    })
  }, [itens, coluna, direcao])

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / tamanho))
  const paginaEfetiva = Math.min(pagina, totalPaginas)

  const pagina_atual = useMemo(() => {
    const inicio = (paginaEfetiva - 1) * tamanho
    return ordenados.slice(inicio, inicio + tamanho)
  }, [ordenados, paginaEfetiva, tamanho])

  function clicarColuna(col: keyof T) {
    if (coluna === col) {
      setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setColuna(col)
      setDirecao('asc')
    }
    setPagina(1) // volta pra 1ª página ao trocar ordenação
  }

  function th(col: keyof T) {
    const ativa = coluna === col
    return {
      className: `th-ordenavel${ativa ? (direcao === 'asc' ? ' th-asc' : ' th-desc') : ''}`,
      onClick: () => clicarColuna(col),
      style: { cursor: 'pointer', userSelect: 'none' as const },
    }
  }

  function irPara(p: number) {
    setPagina(Math.max(1, Math.min(p, totalPaginas)))
  }

  function mudarTamanho(t: TamanhoPagina) {
    setTamanho(t)
    setPagina(1)
  }

  const resetar = useCallback(() => setPagina(1), [])

  return {
    pagina_atual,
    ordenados,
    th,
    pagina: paginaEfetiva,
    totalPaginas,
    total: ordenados.length,
    tamanho,
    irPara,
    mudarTamanho,
    resetar,
  }
}
