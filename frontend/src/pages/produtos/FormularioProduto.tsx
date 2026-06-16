import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useNavegacaoRegistro } from '../../hooks/useNavegacaoRegistro'
import { NavegadorRegistro } from '../../components/NavegadorRegistro'
import { formatarMoeda } from '../../utils/formatar'
import type { Produto } from './types'

type CamposFormulario = {
  modelo: string
  descricao: string
  marca: string
  categoria: string
  preco_custo: string
  preco_venda: string
  moeda: 'BRL' | 'USD'
  preco_usd: string
  peso: string
}

const CAMPOS_VAZIOS: CamposFormulario = {
  modelo: '',
  descricao: '',
  marca: '',
  categoria: '',
  preco_custo: '',
  preco_venda: '',
  moeda: 'BRL',
  preco_usd: '',
  peso: '',
}

function paraFormulario(produto: Produto): CamposFormulario {
  return {
    modelo: produto.modelo ?? '',
    descricao: produto.descricao ?? '',
    marca: produto.marca ?? '',
    categoria: produto.categoria ?? '',
    preco_custo: produto.preco_custo ?? '',
    preco_venda: produto.preco_venda ?? '',
    moeda: produto.moeda === 'USD' ? 'USD' : 'BRL',
    preco_usd: produto.preco_usd ?? '',
    peso: produto.peso ?? '',
  }
}

export function FormularioProduto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS)
  const [precoSugerido, setPrecoSugerido] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!editando) return

    fetch(`/api/produtos/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setCampos(paraFormulario(data.produto))
        setPrecoSugerido(data.produto.preco_sugerido ?? null)
      })
      .catch(() => setErro('Não foi possível carregar o produto.'))
      .finally(() => setCarregando(false))
  }, [id, editando])

  function atualizarCampo(campo: keyof CamposFormulario, valor: string) {
    setCampos((atual) => ({ ...atual, [campo]: valor }))
    if (campo === 'moeda' && valor === 'BRL') {
      setPrecoSugerido(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)

    const body: Record<string, unknown> = { ...campos }
    if (campos.moeda === 'BRL') {
      body.preco_usd = null
    }

    try {
      const res = await fetch(editando ? `/api/produtos/${id}` : '/api/produtos', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
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

  const nav = useNavegacaoRegistro('nav_produtos', id, '/produtos')

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      {editando && (
        <NavegadorRegistro
          temAnterior={nav.temAnterior}
          temProximo={nav.temProximo}
          posicao={nav.posicao}
          total={nav.total}
          onAnterior={nav.irAnterior}
          onProximo={nav.irProximo}
          label="Produto"
        />
      )}
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
              value={campos.descricao}
              onChange={(e) => atualizarCampo('descricao', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="marca">Marca</label>
            <input
              id="marca"
              value={campos.marca}
              onChange={(e) => atualizarCampo('marca', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="categoria">Categoria</label>
            <input
              id="categoria"
              value={campos.categoria}
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
              value={campos.preco_custo}
              onChange={(e) => atualizarCampo('preco_custo', e.target.value)}
            />
          </div>

          {/* ── Moeda ── */}
          <div className="campo">
            <label htmlFor="moeda">Moeda do preço de venda</label>
            <select
              id="moeda"
              value={campos.moeda}
              onChange={(e) => atualizarCampo('moeda', e.target.value as 'BRL' | 'USD')}
            >
              <option value="BRL">Real (BRL)</option>
              <option value="USD">Dólar (USD)</option>
            </select>
          </div>

          {campos.moeda === 'BRL' ? (
            <div className="campo">
              <label htmlFor="preco_venda">Preço de venda (R$)</label>
              <input
                id="preco_venda"
                type="number"
                min="0"
                step="0.01"
                value={campos.preco_venda}
                onChange={(e) => atualizarCampo('preco_venda', e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="campo">
                <label htmlFor="preco_usd">Preço em dólar (US$)</label>
                <input
                  id="preco_usd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={campos.preco_usd}
                  onChange={(e) => atualizarCampo('preco_usd', e.target.value)}
                />
              </div>
              {precoSugerido !== null && (
                <div className="campo">
                  <label>Preço sugerido em R$ (calculado)</label>
                  <input
                    type="text"
                    readOnly
                    value={formatarMoeda(precoSugerido)}
                    style={{ background: 'var(--bg-alt)', cursor: 'default' }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                    preço USD × cotação do dia × fator de markup (setup)
                  </span>
                </div>
              )}
            </>
          )}

          <div className="campo">
            <label htmlFor="peso">Peso (kg)</label>
            <input
              id="peso"
              type="number"
              min="0"
              step="0.001"
              value={campos.peso}
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
