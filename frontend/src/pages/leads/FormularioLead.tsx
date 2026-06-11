import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Lead, StatusLead } from './types'

type UsuarioSimples = { id: number; nome: string }

type CamposFormulario = {
  nome_empresa: string
  contato: string
  telefone: string
  email: string
  cidade: string
  uf: string
  assunto: string
  mensagem: string
  origem: string
  vendedor_id: string
  status: StatusLead
}

const CAMPOS_VAZIOS: CamposFormulario = {
  nome_empresa: '',
  contato: '',
  telefone: '',
  email: '',
  cidade: '',
  uf: '',
  assunto: '',
  mensagem: '',
  origem: '',
  vendedor_id: '',
  status: 'novo',
}

const LABELS_STATUS: Record<StatusLead, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  convertido: 'Convertido',
  descartado: 'Descartado',
}

function paraFormulario(lead: Lead): CamposFormulario {
  return {
    nome_empresa: lead.nome_empresa ?? '',
    contato: lead.contato ?? '',
    telefone: lead.telefone ?? '',
    email: lead.email ?? '',
    cidade: lead.cidade ?? '',
    uf: lead.uf ?? '',
    assunto: lead.assunto ?? '',
    mensagem: lead.mensagem ?? '',
    origem: lead.origem ?? '',
    vendedor_id: lead.vendedor_id ? String(lead.vendedor_id) : '',
    status: lead.status,
  }
}

export function FormularioLead() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS)
  const [lead, setLead] = useState<Lead | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioSimples[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const resUsuarios = await fetch('/api/auth/usuarios', { credentials: 'include' })
        const usuariosData = await resUsuarios.json()
        setUsuarios(usuariosData.usuarios ?? [])

        if (editando && id) {
          const res = await fetch(`/api/leads/${id}`, { credentials: 'include' })
          if (!res.ok) { setErro('Lead não encontrado.'); return }
          const { lead: l } = await res.json()
          setLead(l)
          setCampos(paraFormulario(l))
        }
      } catch {
        setErro('Erro ao carregar dados.')
      } finally {
        setCarregando(false)
      }
    }
    init()
  }, [id, editando])

  function atualizarCampo<K extends keyof CamposFormulario>(campo: K, valor: CamposFormulario[K]) {
    setCampos((atual) => ({ ...atual, [campo]: valor }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)

    try {
      const body = {
        nome_empresa: campos.nome_empresa || null,
        contato: campos.contato || null,
        telefone: campos.telefone || null,
        email: campos.email || null,
        cidade: campos.cidade || null,
        uf: campos.uf || null,
        assunto: campos.assunto || null,
        mensagem: campos.mensagem || null,
        origem: campos.origem || null,
        vendedor_id: campos.vendedor_id || null,
        status: campos.status,
      }
      const res = await fetch(editando ? `/api/leads/${id}` : '/api/leads', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro ?? 'Não foi possível salvar o lead.')
        return
      }

      navigate('/leads')
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <section>
      <h2>{editando ? `Lead #${id}` : 'Novo lead'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="grade-formulario">
          <div className="campo">
            <label htmlFor="nome_empresa">Empresa</label>
            <input
              id="nome_empresa"
              value={campos.nome_empresa}
              onChange={(e) => atualizarCampo('nome_empresa', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="contato">Contato</label>
            <input
              id="contato"
              value={campos.contato}
              onChange={(e) => atualizarCampo('contato', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              value={campos.telefone}
              onChange={(e) => atualizarCampo('telefone', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={campos.email}
              onChange={(e) => atualizarCampo('email', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="cidade">Cidade</label>
            <input
              id="cidade"
              value={campos.cidade}
              onChange={(e) => atualizarCampo('cidade', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="uf">UF</label>
            <input
              id="uf"
              maxLength={2}
              value={campos.uf}
              onChange={(e) => atualizarCampo('uf', e.target.value.toUpperCase())}
            />
          </div>
          <div className="campo campo-largo">
            <label htmlFor="assunto">Assunto</label>
            <input
              id="assunto"
              value={campos.assunto}
              onChange={(e) => atualizarCampo('assunto', e.target.value)}
            />
          </div>
          <div className="campo campo-largo">
            <label htmlFor="mensagem">Mensagem</label>
            <textarea
              id="mensagem"
              value={campos.mensagem}
              onChange={(e) => atualizarCampo('mensagem', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="origem">Origem</label>
            <input
              id="origem"
              placeholder="manual"
              value={campos.origem}
              onChange={(e) => atualizarCampo('origem', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="vendedor_id">Vendedor</label>
            <select
              id="vendedor_id"
              value={campos.vendedor_id}
              onChange={(e) => atualizarCampo('vendedor_id', e.target.value)}
            >
              <option value="">— Sem vendedor —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={campos.status}
              onChange={(e) => atualizarCampo('status', e.target.value as StatusLead)}
            >
              {(Object.keys(LABELS_STATUS) as StatusLead[]).map((status) => (
                <option key={status} value={status}>{LABELS_STATUS[status]}</option>
              ))}
            </select>
          </div>
        </div>

        {lead && (
          <p className="valor-secundario">
            Recebido em {new Date(lead.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        )}

        {erro && (
          <p className="alerta-erro" role="alert">
            {erro}
          </p>
        )}

        <div className="barra-acoes-formulario">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="botao-secundario" type="button" onClick={() => navigate('/leads')}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}
