import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  mascaraCNPJouCPF,
  mascaraTelefone,
  mascaraCEP,
  validarCNPJouCPF,
  validarTelefone,
  validarEmail,
  validarCEP,
} from '../../utils/validacoes'
import { useNavegacaoRegistro } from '../../hooks/useNavegacaoRegistro'
import { NavegadorRegistro } from '../../components/NavegadorRegistro'
import { formatarData } from '../../utils/formatar'
import type { Cliente } from './types'

type Condicao = { id: number; descricao: string }
type Contato = { id: number; nome: string; telefone: string | null; email: string | null }
type CategoriaCliente = { id: number; nome: string }

type CamposFormulario = Omit<Cliente, 'id' | 'ativo' | 'criado_em' | 'categoria_cliente_id' | 'categoria_cliente_nome'> & {
  categoria_cliente_id: string
}

const CAMPOS_VAZIOS: CamposFormulario = {
  razao_social: '',
  nome_fantasia: '',
  cnpj_cpf: '',
  email: '',
  telefone: '',
  whatsapp: '',
  endereco: '',
  cidade: '',
  uf: '',
  cep: '',
  observacoes: '',
  condicoes_pagamento: '',
  categoria_cliente_id: '',
}

function paraFormulario(cliente: Cliente): CamposFormulario {
  const campos = { ...CAMPOS_VAZIOS }
  for (const chave of Object.keys(campos) as (keyof CamposFormulario)[]) {
    if (chave === 'categoria_cliente_id') continue
    campos[chave] = (cliente as any)[chave] ?? ''
  }
  campos.categoria_cliente_id = cliente.categoria_cliente_id != null ? String(cliente.categoria_cliente_id) : ''
  if (campos.cnpj_cpf) campos.cnpj_cpf = mascaraCNPJouCPF(campos.cnpj_cpf)
  if (campos.telefone) campos.telefone = mascaraTelefone(campos.telefone)
  if (campos.whatsapp) campos.whatsapp = mascaraTelefone(campos.whatsapp)
  if (campos.cep) campos.cep = mascaraCEP(campos.cep)
  return campos
}

type Erros = Partial<Record<keyof CamposFormulario, string>>

function validarCampos(campos: CamposFormulario): Erros {
  const erros: Erros = {}
  if (campos.cnpj_cpf && !validarCNPJouCPF(campos.cnpj_cpf)) erros.cnpj_cpf = 'CNPJ ou CPF inválido.'
  if (campos.email && !validarEmail(campos.email)) erros.email = 'E-mail inválido.'
  if (campos.telefone && !validarTelefone(campos.telefone)) erros.telefone = 'Telefone inválido.'
  if (campos.whatsapp && !validarTelefone(campos.whatsapp)) erros.whatsapp = 'WhatsApp inválido.'
  if (campos.cep && !validarCEP(campos.cep)) erros.cep = 'CEP inválido.'
  return erros
}

const CONTATO_VAZIO = { nome: '', telefone: '', email: '' }

export function FormularioCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS)
  const [criadoEm, setCriadoEm] = useState<string | null>(null)
  const [listaCondicoes, setListaCondicoes] = useState<string[]>([])
  const [listaCategorias, setListaCategorias] = useState<CategoriaCliente[]>([])
  const [errosCampo, setErrosCampo] = useState<Erros>({})
  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Contatos multivalorados
  const [contatos, setContatos] = useState<Contato[]>([])
  const [novoContato, setNovoContato] = useState(CONTATO_VAZIO)
  const [editandoContato, setEditandoContato] = useState<number | null>(null)
  const [editContato, setEditContato] = useState(CONTATO_VAZIO)

  useEffect(() => {
    fetch('/api/setup/condicoes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setListaCondicoes((d.condicoes ?? []).map((c: Condicao) => c.descricao)))
      .catch(() => null)
    fetch('/api/categorias-cliente', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setListaCategorias(d.categorias ?? []))
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (!editando) return
    Promise.all([
      fetch(`/api/clientes/${id}`, { credentials: 'include' }).then((r) => r.ok ? r.json() : Promise.reject()),
      fetch(`/api/clientes/${id}/contatos`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([data, cdata]) => {
        setCampos(paraFormulario(data.cliente))
        setCriadoEm(data.cliente.criado_em ?? null)
        setContatos(cdata.contatos ?? [])
      })
      .catch(() => setErro('Não foi possível carregar o cliente.'))
      .finally(() => setCarregando(false))
  }, [id, editando])

  function atualizarCampo(campo: keyof CamposFormulario, valor: string) {
    if (errosCampo[campo]) setErrosCampo((e) => ({ ...e, [campo]: undefined }))
    setCampos((atual) => ({ ...atual, [campo]: valor }))
  }

  function validarCampo(campo: keyof CamposFormulario) {
    const novos = validarCampos(campos)
    setErrosCampo((e) => ({ ...e, [campo]: novos[campo] }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const erros = validarCampos(campos)
    if (Object.keys(erros).length > 0) {
      setErrosCampo(erros)
      setErro('Corrija os campos destacados antes de salvar.')
      return
    }
    setErro(null)
    setSalvando(true)
    try {
      const res = await fetch(editando ? `/api/clientes/${id}` : '/api/clientes', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(campos),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Não foi possível salvar o cliente.'); return }
      navigate('/clientes')
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Contatos ────────────────────────────────────────────────────────────────

  async function adicionarContato() {
    if (!novoContato.nome.trim() || !id) return
    const res = await fetch(`/api/clientes/${id}/contatos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(novoContato),
    })
    const d = await res.json()
    if (res.ok) {
      setContatos((prev) => [...prev, d.contato])
      setNovoContato(CONTATO_VAZIO)
    }
  }

  async function salvarEdicaoContato(cid: number) {
    if (!editContato.nome.trim() || !id) return
    await fetch(`/api/clientes/${id}/contatos/${cid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(editContato),
    })
    setContatos((prev) => prev.map((c) => c.id === cid ? { ...c, ...editContato } : c))
    setEditandoContato(null)
  }

  async function removerContato(cid: number) {
    if (!id) return
    await fetch(`/api/clientes/${id}/contatos/${cid}`, { method: 'DELETE', credentials: 'include' })
    setContatos((prev) => prev.filter((c) => c.id !== cid))
  }

  const nav = useNavegacaoRegistro('nav_clientes', id, '/clientes', '/editar')

  if (carregando) return <p>Carregando...</p>

  const ec = errosCampo

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
          label="Cliente"
        />
      )}
      <h2>
        {editando ? 'Editar cliente' : 'Novo cliente'}
        {criadoEm && (
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text)', marginLeft: '16px' }}>
            Cadastrado em {formatarData(criadoEm)}
          </span>
        )}
      </h2>

      <form onSubmit={handleSubmit}>

        {/* Linha 1: Razão social + Nome fantasia + Categoria */}
        <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr 200px' }}>
          <div className="campo">
            <label htmlFor="razao_social">Razão social *</label>
            <input
              id="razao_social"
              value={campos.razao_social}
              onChange={(e) => atualizarCampo('razao_social', e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="nome_fantasia">Nome fantasia</label>
            <input
              id="nome_fantasia"
              value={campos.nome_fantasia ?? ''}
              onChange={(e) => atualizarCampo('nome_fantasia', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="categoria_cliente_id">Categoria</label>
            <select
              id="categoria_cliente_id"
              value={campos.categoria_cliente_id}
              onChange={(e) => atualizarCampo('categoria_cliente_id', e.target.value)}
            >
              <option value="">—</option>
              {listaCategorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Linha 2: CNPJ | E-mail | Telefone | WhatsApp */}
        <div className="grade-formulario grade-4col">
          <div className={`campo${ec.cnpj_cpf ? ' campo-invalido' : ''}`}>
            <label htmlFor="cnpj_cpf">CNPJ/CPF</label>
            <input
              id="cnpj_cpf"
              value={campos.cnpj_cpf ?? ''}
              onChange={(e) => atualizarCampo('cnpj_cpf', mascaraCNPJouCPF(e.target.value))}
              onBlur={() => validarCampo('cnpj_cpf')}
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
            {ec.cnpj_cpf && <span className="campo-erro">{ec.cnpj_cpf}</span>}
          </div>
          <div className={`campo${ec.email ? ' campo-invalido' : ''}`}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="text"
              value={campos.email ?? ''}
              onChange={(e) => atualizarCampo('email', e.target.value)}
              onBlur={() => validarCampo('email')}
              placeholder="contato@empresa.com.br"
            />
            {ec.email && <span className="campo-erro">{ec.email}</span>}
          </div>
          <div className={`campo${ec.telefone ? ' campo-invalido' : ''}`}>
            <label htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              value={campos.telefone ?? ''}
              onChange={(e) => atualizarCampo('telefone', mascaraTelefone(e.target.value))}
              onBlur={() => validarCampo('telefone')}
              placeholder="(11) 9999-9999"
              maxLength={15}
            />
            {ec.telefone && <span className="campo-erro">{ec.telefone}</span>}
          </div>
          <div className={`campo${ec.whatsapp ? ' campo-invalido' : ''}`}>
            <label htmlFor="whatsapp">WhatsApp</label>
            <input
              id="whatsapp"
              value={campos.whatsapp ?? ''}
              onChange={(e) => atualizarCampo('whatsapp', mascaraTelefone(e.target.value))}
              onBlur={() => validarCampo('whatsapp')}
              placeholder="(11) 99999-9999"
              maxLength={15}
            />
            {ec.whatsapp && <span className="campo-erro">{ec.whatsapp}</span>}
          </div>
        </div>

        {/* Linha 3: Endereço | Cidade + UF + CEP */}
        <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="campo">
            <label htmlFor="endereco">Endereço</label>
            <input
              id="endereco"
              value={campos.endereco ?? ''}
              onChange={(e) => atualizarCampo('endereco', e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: '8px' }}>
            <div className="campo">
              <label htmlFor="cidade">Cidade</label>
              <input
                id="cidade"
                value={campos.cidade ?? ''}
                onChange={(e) => atualizarCampo('cidade', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="uf">UF</label>
              <input
                id="uf"
                maxLength={2}
                value={campos.uf ?? ''}
                onChange={(e) => atualizarCampo('uf', e.target.value.toUpperCase())}
              />
            </div>
            <div className={`campo${ec.cep ? ' campo-invalido' : ''}`}>
              <label htmlFor="cep">CEP</label>
              <input
                id="cep"
                value={campos.cep ?? ''}
                onChange={(e) => atualizarCampo('cep', mascaraCEP(e.target.value))}
                onBlur={() => validarCampo('cep')}
                placeholder="00000-000"
                maxLength={9}
              />
              {ec.cep && <span className="campo-erro">{ec.cep}</span>}
            </div>
          </div>
        </div>

        {/* Linha 4: Observações | Condições + botões */}
        <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'stretch' }}>
          <div className="campo">
            <label htmlFor="observacoes">Observações</label>
            <textarea
              id="observacoes"
              className="sem-uppercase"
              rows={1}
              style={{ resize: 'vertical', minHeight: '38px' }}
              value={campos.observacoes ?? ''}
              onChange={(e) => atualizarCampo('observacoes', e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="campo" style={{ flex: 1 }}>
              <label htmlFor="condicoes_pagamento">Condições de pagamento padrão</label>
              <input
                id="condicoes_pagamento"
                className="sem-uppercase"
                list="lista-condicoes-cli"
                value={campos.condicoes_pagamento ?? ''}
                onChange={(e) => atualizarCampo('condicoes_pagamento', e.target.value)}
                autoComplete="off"
              />
              <datalist id="lista-condicoes-cli">
                {listaCondicoes.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            {erro && <p className="alerta-erro" role="alert" style={{ margin: '4px 0' }}>{erro}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="botao-secundario" type="button" onClick={() => navigate('/clientes')}>
                Cancelar
              </button>
              <button className="botao" type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>

      </form>

      {/* ── Contatos ─────────────────────────────────────────────── */}
      {editando && (
        <div style={{ marginTop: '4px' }}>
          <h3 style={{ fontSize: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '14px' }}>
            Contatos
          </h3>

          {/* Formulário novo contato */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end', marginBottom: '12px' }}>
            <div className="campo" style={{ margin: 0 }}>
              <label>Nome *</label>
              <input
                placeholder="Nome do contato"
                value={novoContato.nome}
                onChange={(e) => setNovoContato((p) => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="campo" style={{ margin: 0 }}>
              <label>Telefone</label>
              <input
                placeholder="(11) 99999-9999"
                value={novoContato.telefone}
                onChange={(e) => setNovoContato((p) => ({ ...p, telefone: mascaraTelefone(e.target.value) }))}
                maxLength={15}
              />
            </div>
            <div className="campo" style={{ margin: 0 }}>
              <label>E-mail</label>
              <input
                placeholder="email@contato.com"
                value={novoContato.email}
                onChange={(e) => setNovoContato((p) => ({ ...p, email: e.target.value }))}
                className="sem-uppercase"
              />
            </div>
            <button
              className="botao"
              type="button"
              onClick={adicionarContato}
              disabled={!novoContato.nome.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              + Adicionar
            </button>
          </div>

          {contatos.length > 0 && (
            <div className="tabela-wrapper">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>E-mail</th>
                    <th style={{ width: '110px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {contatos.map((c) => (
                    <tr key={c.id}>
                      {editandoContato === c.id ? (
                        <>
                          <td><input value={editContato.nome} onChange={(e) => setEditContato((p) => ({ ...p, nome: e.target.value }))} /></td>
                          <td><input value={editContato.telefone} onChange={(e) => setEditContato((p) => ({ ...p, telefone: mascaraTelefone(e.target.value) }))} maxLength={15} /></td>
                          <td><input value={editContato.email} onChange={(e) => setEditContato((p) => ({ ...p, email: e.target.value }))} className="sem-uppercase" /></td>
                          <td>
                            <div className="acoes">
                              <button className="botao-link" type="button" onClick={() => salvarEdicaoContato(c.id)}>Salvar</button>
                              <button className="botao-link" type="button" onClick={() => setEditandoContato(null)}>Cancel.</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{c.nome}</td>
                          <td>{c.telefone ?? '—'}</td>
                          <td>{c.email ?? '—'}</td>
                          <td>
                            <div className="acoes">
                              <button className="botao-link" type="button" onClick={() => { setEditandoContato(c.id); setEditContato({ nome: c.nome, telefone: c.telefone ?? '', email: c.email ?? '' }) }}>Editar</button>
                              <button className="botao-perigo" type="button" onClick={() => removerContato(c.id)}>Remover</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {contatos.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--text)' }}>Nenhum contato cadastrado. Use o formulário acima para adicionar.</p>
          )}
        </div>
      )}
    </section>
  )
}
