type Props = {
  temAnterior: boolean
  temProximo: boolean
  posicao: number | null
  total: number
  onAnterior: () => void
  onProximo: () => void
  label?: string
}

export function NavegadorRegistro({ temAnterior, temProximo, posicao, total, onAnterior, onProximo, label }: Props) {
  if (total === 0) return null

  return (
    <div className="navegador-registro">
      <button
        className="navegador-btn"
        type="button"
        onClick={onAnterior}
        disabled={!temAnterior}
        title="Registro anterior"
      >
        ← Anterior
      </button>
      {posicao != null && (
        <span className="navegador-posicao">
          {label ? `${label} ` : ''}{posicao} / {total}
        </span>
      )}
      <button
        className="navegador-btn"
        type="button"
        onClick={onProximo}
        disabled={!temProximo}
        title="Próximo registro"
      >
        Próximo →
      </button>
    </div>
  )
}
