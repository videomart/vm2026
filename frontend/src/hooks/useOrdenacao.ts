import { useMemo, useState } from 'react'

export type Direcao = 'asc' | 'desc'

export function useOrdenacao<T>(itens: T[], colunaInicial?: keyof T) {
  const [coluna, setColuna] = useState<keyof T | null>(colunaInicial ?? null)
  const [direcao, setDirecao] = useState<Direcao>('asc')

  function clicarColuna(col: keyof T) {
    if (coluna === col) {
      setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setColuna(col)
      setDirecao('asc')
    }
  }

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

  function props(col: keyof T) {
    const ativa = coluna === col
    return {
      className: `th-ordenavel${ativa ? (direcao === 'asc' ? ' th-asc' : ' th-desc') : ''}`,
      onClick: () => clicarColuna(col),
      style: { cursor: 'pointer', userSelect: 'none' as const },
    }
  }

  return { ordenados, props, coluna, direcao }
}
