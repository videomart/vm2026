import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Cliente } from './types'

type CamposFormulario = Omit<Cliente, 'id' | 'ativo'>

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
}

function paraFormulario(cliente: Cliente): CamposFormulario {
  const campos = { ...CAMPOS_VAZIOS }
  for (const chave of Object.keys(campos) as (keyof CamposFormulario)[]) {
    campos[chave] = cliente[chave] ?? ''
  }
  return campos
}

export function FormularioCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS)
  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!editando) return

    fetch(`/api/clientes/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setCampos(paraFormulario(data.cliente)))
      .catch(() => setErro('Não foi possível carregar o cliente.'))
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
      const res = await fetch(editando ? `/api/clientes/${id}` : '/api/clientes', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(campos),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro ?? 'Não foi possível salvar o cliente.')
        return
      }

      navigate('/clientes')
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
      <h2>{editando ? 'Editar cliente' : 'Novo cliente'}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="razao_social">Razão social *</label>
          <br />
          <input
            id="razao_social"
            value={campos.razao_social}
            onChange={(e) => atualizarCampo('razao_social', e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="nome_fantasia">Nome fantasia</label>
          <br />
          <input
            id="nome_fantasia"
            value={campos.nome_fantasia ?? ''}
            onChange={(e) => atualizarCampo('nome_fantasia', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cnpj_cpf">CNPJ/CPF</label>
          <br />
          <input
            id="cnpj_cpf"
            value={campos.cnpj_cpf ?? ''}
            onChange={(e) => atualizarCampo('cnpj_cpf', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email">E-mail</label>
          <br />
          <input
            id="email"
            type="email"
            value={campos.email ?? ''}
            onChange={(e) => atualizarCampo('email', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="telefone">Telefone</label>
          <br />
          <input
            id="telefone"
            value={campos.telefone ?? ''}
            onChange={(e) => atualizarCampo('telefone', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="whatsapp">WhatsApp</label>
          <br />
          <input
            id="whatsapp"
            value={campos.whatsapp ?? ''}
            onChange={(e) => atualizarCampo('whatsapp', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="endereco">Endereço</label>
          <br />
          <input
            id="endereco"
            value={campos.endereco ?? ''}
            onChange={(e) => atualizarCampo('endereco', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cidade">Cidade</label>
          <br />
          <input
            id="cidade"
            value={campos.cidade ?? ''}
            onChange={(e) => atualizarCampo('cidade', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="uf">UF</label>
          <br />
          <input
            id="uf"
            maxLength={2}
            value={campos.uf ?? ''}
            onChange={(e) => atualizarCampo('uf', e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label htmlFor="cep">CEP</label>
          <br />
          <input
            id="cep"
            value={campos.cep ?? ''}
            onChange={(e) => atualizarCampo('cep', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="observacoes">Observações</label>
          <br />
          <textarea
            id="observacoes"
            value={campos.observacoes ?? ''}
            onChange={(e) => atualizarCampo('observacoes', e.target.value)}
          />
        </div>
        {erro && <p role="alert">{erro}</p>}
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>{' '}
        <button type="button" onClick={() => navigate('/clientes')}>
          Cancelar
        </button>
      </form>
    </section>
  )
}
