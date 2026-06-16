import { OPCOES_TAMANHO } from '../hooks/usePaginacao'
import type { TamanhoPagina } from '../hooks/usePaginacao'

type Props = {
  pagina: number
  totalPaginas: number
  total: number
  tamanho: TamanhoPagina
  onIrPara: (p: number) => void
  onMudarTamanho: (t: TamanhoPagina) => void
}

export function Paginacao({ pagina, totalPaginas, total, tamanho, onIrPara, onMudarTamanho }: Props) {
  if (total === 0) return null

  // Gera array de páginas com reticências para listas longas
  function paginas(): (number | '…')[] {
    if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    const arr: (number | '…')[] = [1]
    if (pagina > 3) arr.push('…')
    for (let p = Math.max(2, pagina - 1); p <= Math.min(totalPaginas - 1, pagina + 1); p++) arr.push(p)
    if (pagina < totalPaginas - 2) arr.push('…')
    arr.push(totalPaginas)
    return arr
  }

  const inicio = (pagina - 1) * tamanho + 1
  const fim = Math.min(pagina * tamanho, total)

  return (
    <div className="paginacao">
      <span className="paginacao-info">
        {inicio}–{fim} de {total}
      </span>

      <div className="paginacao-controles">
        <button
          className="paginacao-btn"
          onClick={() => onIrPara(pagina - 1)}
          disabled={pagina === 1}
          aria-label="Página anterior"
        >
          ‹
        </button>

        {paginas().map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="paginacao-reticencias">…</span>
          ) : (
            <button
              key={p}
              className={`paginacao-btn${p === pagina ? ' paginacao-btn-ativo' : ''}`}
              onClick={() => onIrPara(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          className="paginacao-btn"
          onClick={() => onIrPara(pagina + 1)}
          disabled={pagina === totalPaginas}
          aria-label="Próxima página"
        >
          ›
        </button>
      </div>

      <div className="paginacao-tamanho">
        <label htmlFor="pag-tamanho">Por página:</label>
        <select
          id="pag-tamanho"
          value={tamanho}
          onChange={(e) => onMudarTamanho(Number(e.target.value) as TamanhoPagina)}
        >
          {OPCOES_TAMANHO.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
          {!OPCOES_TAMANHO.includes(tamanho as any) && (
            <option value={tamanho}>{tamanho}</option>
          )}
        </select>
      </div>
    </div>
  )
}
