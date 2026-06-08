import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Produto } from './types'

type CamposFormulario = Omit<Produto, 'id' | 'ativo'>

const CAMPOS_VAZIOS: CamposFormulario = {
  modelo: '',
  descricao: '',
  marca: '',
  categoria: '',
  preco_custo: '',
  preco_venda: '',
  peso: '',
}

function paraFormulario(produto: Produto): CamposFormulario {
  const campos = { ...CAMPOS_VAZIOS }
  for (const chave of Object.keys(campos) as (keyof CamposFormulario)[]) {
    campos[chave] = produto[chave] ?? ''
  }
  return campos
}

export function FormularioProduto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS)
  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!editando) return

    fetch(`/api/produtos/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setCampos(paraFormulario(data.produto)))
      .catch(() => setErro('Não foi possível carregar o produto.'))
      .finally(() => setCarregando(false))
  }, [id, editando])

  function atualizarCampo(campo: keyof CamposFormulario, valor: string) {
    setCampos((atual) => ({ ...atual, [campo]: valor }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)

    try {
      const res = await fetch(editando ? `/api/produtos/${id}` : '/api/produtos', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(campos),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro ?? 'Não foi possível salvar o produto.')
        return
      }

      navigate('/produtos')
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>{editando ? 'Editar produto' : 'Novo produto'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="grade-formulario">
          <div className="campo campo-largo">
            <label htmlFor="modelo">Modelo *</label>
            <input
              id="modelo"
              value={campos.modelo}
              onChange={(e) => atualizarCampo('modelo', e.target.value)}
              required
            />
          </div>
          <div className="campo campo-largo">
            <label htmlFor="descricao">Descrição</label>
            <input
              id="descricao"
              value={campos.descricao ?? ''}
              onChange={(e) => atualizarCampo('descricao', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="marca">Marca</label>
            <input
              id="marca"
              value={campos.marca ?? ''}
              onChange={(e) => atualizarCampo('marca', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="categoria">Categoria</label>
            <input
              id="categoria"
              value={campos.categoria ?? ''}
              onChange={(e) => atualizarCampo('categoria', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="preco_custo">Preço de custo (R$)</label>
            <input
              id="preco_custo"
              type="number"
              min="0"
              step="0.01"
              value={campos.preco_custo ?? ''}
              onChange={(e) => atualizarCampo('preco_custo', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="preco_venda">Preço de venda (R$)</label>
            <input
              id="preco_venda"
              type="number"
              min="0"
              step="0.01"
              value={campos.preco_venda ?? ''}
              onChange={(e) => atualizarCampo('preco_venda', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="peso">Peso (kg)</label>
            <input
              id="peso"
              type="number"
              min="0"
              step="0.001"
              value={campos.peso ?? ''}
              onChange={(e) => atualizarCampo('peso', e.target.value)}
            />
          </div>
        </div>

        {erro && (
          <p className="alerta-erro" role="alert">
            {erro}
          </p>
        )}

        <div className="barra-acoes-formulario">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="botao-secundario" type="button" onClick={() => navigate('/produtos')}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}
