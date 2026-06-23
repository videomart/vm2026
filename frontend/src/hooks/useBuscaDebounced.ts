import { useEffect, useState } from 'react'

/**
 * Atrasa a propagação de um valor de busca por `delayMs`, para disparar a
 * consulta automaticamente enquanto o usuário digita, sem precisar de
 * botão/Enter — mesmo padrão usado na busca de cliente em Propostas.
 */
export function useBuscaDebounced(valor: string, delayMs = 300): string {
  const [debounced, setDebounced] = useState(valor)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), delayMs)
    return () => clearTimeout(timer)
  }, [valor, delayMs])

  return debounced
}
