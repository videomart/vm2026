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

type CamposFormulario = Omit<Cliente, 'id' | 'ativo' | 'criado_em'>

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
}

function paraFormulario(cliente: Cliente): CamposFormulario {
  const campos = { ...CAMPOS_VAZIOS }
  for (const chave of Object.keys(campos) as (keyof CamposFormulario)[]) {
    campos[chave] = cliente[chave] ?? ''
  }
  return campos
}

type Erros = Partial<Record<keyof CamposFormulario, string>>

function validarCampos(campos: CamposFormulario): Erros {
  const erros: Erros = {}
  if (campos.cnpj_cpf && !validarCNPJouCPF(campos.cnpj_cpf)) {
    erros.cnpj_cpf = 'CNPJ ou CPF inválido.'
  }
  if (campos.email && !validarEmail(campos.email)) {
    erros.email = 'E-mail inválido.'
  }
  if (campos.telefone && !validarTelefone(campos.telefone)) {
    erros.telefone = 'Telefone inválido. Use (DDD) + número.'
  }
  if (campos.whatsapp && !validarTelefone(campos.whatsapp)) {
    erros.whatsapp = 'WhatsApp inválido. Use (DDD) + número.'
  }
  if (campos.cep && !validarCEP(campos.cep)) {
    erros.cep = 'CEP inválido. Use 8 dígitos.'
  }
  return erros
}

export function FormularioCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS)
  const [criadoEm, setCriadoEm] = useState<string | null>(null)
  const [listaCondicoes, setListaCondicoes] = useState<string[]>([])
  const [errosCampo, setErrosCampo] = useState<Erros>({})
  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/setup/condicoes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setListaCondicoes((d.condicoes ?? []).map((c: Condicao) => c.descricao)))
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (!editando) return
    fetch(`/api/clientes/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setCampos(paraFormulario(data.cliente))
        setCriadoEm(data.cliente.criado_em ?? null)
      })
      .catch(() => setErro('Não foi possível carregar o cliente.'))
      .finally(() => setCarregando(false))
  }, [id, editando])

  function atualizarCampo(campo: keyof CamposFormulario, valor: string) {
    // Limpa erro do campo ao editar
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
        <div className="grade-formulario">

          <div className="campo campo-largo">
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
              placeholder="(11) 99999-9999"
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

          <div className="campo campo-largo">
            <label htmlFor="endereco">Endereço</label>
            <input
              id="endereco"
              value={campos.endereco ?? ''}
              onChange={(e) => atualizarCampo('endereco', e.target.value)}
            />
          </div>

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

          <div className="campo campo-largo">
            <label htmlFor="observacoes">Observações</label>
            <textarea
              id="observacoes"
              value={campos.observacoes ?? ''}
              onChange={(e) => atualizarCampo('observacoes', e.target.value)}
            />
          </div>

          <div className="campo campo-largo">
            <label htmlFor="condicoes_pagamento">Condições de pagamento padrão</label>
            <input
              id="condicoes_pagamento"
              list="lista-condicoes-cli"
              value={campos.condicoes_pagamento ?? ''}
              onChange={(e) => atualizarCampo('condicoes_pagamento', e.target.value)}
              autoComplete="off"
            />
            <datalist id="lista-condicoes-cli">
              {listaCondicoes.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        {erro && <p className="alerta-erro" role="alert">{erro}</p>}

        <div className="barra-acoes-formulario">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="botao-secundario" type="button" onClick={() => navigate('/clientes')}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}
