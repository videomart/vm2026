import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useNavegacaoRegistro } from '../../hooks/useNavegacaoRegistro'
import { NavegadorRegistro } from '../../components/NavegadorRegistro'
import { formatarMoeda } from '../../utils/formatar'
import type { ComposicaoHardware, Produto, TipoOferta } from './types'

type CamposFormulario = {
  modelo: string
  descricao: string
  marca: string
  categoria: string
  tipo_oferta: TipoOferta
  composicao_hardware: string
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
  tipo_oferta: 'software_venda',
  composicao_hardware: '',
  preco_custo: '',
  preco_venda: '',
  moeda: 'BRL',
  preco_usd: '',
  peso: '',
}

const LABELS_TIPO_OFERTA: Record<TipoOferta, string> = {
  turnkey: 'Solução integrada (turnkey)',
  software_venda: 'Produto-venda',
  saas: 'Software - SaaS',
}

function paraFormulario(produto: Produto): CamposFormulario {
  return {
    modelo: produto.modelo ?? '',
    descricao: produto.descricao ?? '',
    marca: produto.marca ?? '',
    categoria: produto.categoria ?? '',
    tipo_oferta: produto.tipo_oferta ?? 'software_venda',
    composicao_hardware: produto.composicao_hardware ?? '',
    preco_custo: produto.preco_custo ?? '',
    preco_venda: produto.preco_venda ?? '',
    moeda: produto.moeda === 'USD' ? 'USD' : 'BRL',
    preco_usd: produto.preco_usd ?? '',
    peso: produto.peso ?? '',
  }
}

function gerarDescricao(c: CamposFormulario): string {
  const partes: string[] = []
  if (c.categoria) partes.push(c.categoria)
  if (c.marca) partes.push(c.marca)
  if (c.modelo) partes.push(c.modelo)
  if (c.peso) partes.push(`peso=${c.peso}kg`)
  return partes.join(' ')
}

export function FormularioProduto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS)
  const [precoSugerido, setPrecoSugerido] = useState<number | null>(null)
  const [listaMarcas, setListaMarcas] = useState<string[]>([])
  const [listaCategorias, setListaCategorias] = useState<string[]>([])
  const [listaComposicoes, setListaComposicoes] = useState<ComposicaoHardware[]>([])
  const setupRef = useRef<{ fator: number; cotacao: number | null }>({ fator: 1.3, cotacao: null })
  const descricaoEditada = useRef(false)

  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/setup', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/api/setup/cotacao', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/api/marcas', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/api/categorias', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/api/composicoes-hardware', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
    ]).then(([ds, dco, dm, dc, dch]) => {
      setupRef.current = {
        fator: Number(ds?.setup?.fator_markup_usd ?? 1.3),
        cotacao: dco?.cotacao?.valor ? Number(dco.cotacao.valor) : null,
      }
      setListaMarcas((dm?.marcas ?? []).map((m: { nome: string }) => m.nome))
      setListaCategorias((dc?.categorias ?? []).map((c: { nome: string }) => c.nome))
      setListaComposicoes(dch?.composicoes ?? [])
    })

    if (!editando) return

    fetch(`/api/produtos/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        descricaoEditada.current = true
        setCampos(paraFormulario(data.produto))
        setPrecoSugerido(data.produto.preco_sugerido ?? null)
      })
      .catch(() => setErro('Não foi possível carregar o produto.'))
      .finally(() => setCarregando(false))
  }, [id, editando])

  function calcularVenda(c: CamposFormulario): string {
    const { fator, cotacao } = setupRef.current
    if (c.moeda === 'USD') {
      const usd = Number(c.preco_usd)
      if (!usd || !cotacao) return ''
      return String(Math.round(usd * cotacao * fator * 100) / 100)
    }
    const custo = Number(c.preco_custo)
    if (!custo) return ''
    return String(Math.round(custo * fator * 100) / 100)
  }

  function atualizar(campo: keyof CamposFormulario, valor: string) {
    setCampos((prev) => {
      const novo = { ...prev, [campo]: valor }

      if (!descricaoEditada.current && campo !== 'descricao') {
        novo.descricao = gerarDescricao(novo)
      }

      if (['preco_custo', 'preco_usd', 'moeda'].includes(campo)) {
        novo.preco_venda = calcularVenda(novo)
        if (campo === 'moeda' && valor === 'BRL') {
          setPrecoSugerido(null)
        }
        if (campo === 'preco_usd' && prev.moeda === 'USD') {
          const { cotacao, fator } = setupRef.current
          const usd = Number(valor)
          setPrecoSugerido(usd && cotacao ? Math.round(usd * cotacao * fator * 100) / 100 : null)
        }
        if (campo === 'moeda' && valor === 'USD') {
          const { cotacao, fator } = setupRef.current
          const usd = Number(novo.preco_usd)
          setPrecoSugerido(usd && cotacao ? Math.round(usd * cotacao * fator * 100) / 100 : null)
        }
      }

      return novo
    })
  }

  function onDescricaoChange(valor: string) {
    descricaoEditada.current = true
    setCampos((prev) => ({ ...prev, descricao: valor }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)

    const body: Record<string, unknown> = { ...campos }
    if (campos.moeda === 'BRL') body.preco_usd = null
    if (campos.moeda === 'USD') body.preco_custo = null
    if (campos.tipo_oferta !== 'turnkey') body.composicao_hardware = null

    try {
      const res = await fetch(editando ? `/api/produtos/${id}` : '/api/produtos', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Não foi possível salvar o produto.'); return }

      // se marca ou categoria nova, adiciona nas tabelas para aparecer no autocomplete futuro
      if (campos.marca) {
        fetch('/api/marcas', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: campos.marca }),
        }).catch(() => null)
      }
      if (campos.categoria) {
        fetch('/api/categorias', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: campos.categoria }),
        }).catch(() => null)
      }

      navigate('/produtos')
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  const nav = useNavegacaoRegistro('nav_produtos', id, '/produtos', '/editar')

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
        <div className="grade-formulario grade-4col">

          {/* Linha 1: Modelo | Categoria | Marca | Peso — todos na mesma linha */}
          <div className="campo">
            <label htmlFor="modelo">Modelo *</label>
            <input
              id="modelo"
              value={campos.modelo}
              onChange={(e) => atualizar('modelo', e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="categoria">Categoria</label>
            <input
              id="categoria"
              list="lista-categorias"
              value={campos.categoria}
              onChange={(e) => atualizar('categoria', e.target.value)}
              autoComplete="off"
            />
            <datalist id="lista-categorias">
              {listaCategorias.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="campo">
            <label htmlFor="marca">Marca</label>
            <input
              id="marca"
              list="lista-marcas"
              value={campos.marca}
              onChange={(e) => atualizar('marca', e.target.value)}
              autoComplete="off"
            />
            <datalist id="lista-marcas">
              {listaMarcas.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div className="campo">
            <label htmlFor="peso">Peso (kg)</label>
            <input
              id="peso"
              type="number"
              min="0"
              step="0.001"
              value={campos.peso}
              onChange={(e) => atualizar('peso', e.target.value)}
            />
          </div>

          {/* Linha 2: Descrição (largo) */}
          <div className="campo campo-largo">
            <label htmlFor="descricao">Descrição</label>
            <input
              id="descricao"
              value={campos.descricao}
              onChange={(e) => onDescricaoChange(e.target.value)}
            />
          </div>

          {/* Linha extra: Tipo do produto */}
          <div className="campo">
            <label htmlFor="tipo_oferta">Tipo do produto</label>
            <select
              id="tipo_oferta"
              value={campos.tipo_oferta}
              onChange={(e) => atualizar('tipo_oferta', e.target.value as TipoOferta)}
            >
              {Object.entries(LABELS_TIPO_OFERTA).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </select>
          </div>

          {/* Se turnkey: composição de hardware */}
          {campos.tipo_oferta === 'turnkey' && (
            <div className="campo campo-largo">
              <label htmlFor="composicao_hardware">Composição do hardware</label>
              {listaComposicoes.length > 0 && (
                <select
                  id="composicao_hardware_select"
                  value=""
                  onChange={(e) => {
                    const comp = listaComposicoes.find((c) => String(c.id) === e.target.value)
                    if (comp) setCampos((prev) => ({ ...prev, composicao_hardware: comp.itens }))
                  }}
                  style={{ marginBottom: '4px' }}
                >
                  <option value="">— Carregar composição padrão —</option>
                  {listaComposicoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              )}
              <textarea
                id="composicao_hardware"
                className="sem-uppercase"
                rows={6}
                placeholder="1 item por linha (ex.: Processador i7, 16GB RAM, SSD 512GB)"
                value={campos.composicao_hardware}
                onChange={(e) => atualizar('composicao_hardware', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          )}

          {/* Linha 3: Moeda | Preço de compra | (USD) | Preço de venda */}
          <div className="campo">
            <label htmlFor="moeda">Moeda</label>
            <select
              id="moeda"
              value={campos.moeda}
              onChange={(e) => atualizar('moeda', e.target.value as 'BRL' | 'USD')}
            >
              <option value="BRL">Real (BRL)</option>
              <option value="USD">Dólar (USD)</option>
            </select>
          </div>
          {campos.moeda === 'USD' ? (
            <div className="campo">
              <label htmlFor="preco_usd">Preço de compra (US$)</label>
              <input
                id="preco_usd"
                type="number"
                min="0"
                step="0.01"
                value={campos.preco_usd}
                onChange={(e) => atualizar('preco_usd', e.target.value)}
              />
            </div>
          ) : (
            <div className="campo">
              <label htmlFor="preco_custo">Preço de compra (R$)</label>
              <input
                id="preco_custo"
                type="number"
                min="0"
                step="0.01"
                value={campos.preco_custo}
                onChange={(e) => atualizar('preco_custo', e.target.value)}
              />
            </div>
          )}
          <div className="campo">
            <label htmlFor="preco_venda">Preço de venda (R$)</label>
            <input
              id="preco_venda"
              type="number"
              min="0"
              step="0.01"
              value={campos.preco_venda}
              onChange={(e) => atualizar('preco_venda', e.target.value)}
            />
            {campos.moeda === 'USD' && precoSugerido !== null && (
              <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                Sugerido: {formatarMoeda(precoSugerido)}
              </span>
            )}
          </div>

        </div>

        {erro && <p className="alerta-erro" role="alert">{erro}</p>}

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
