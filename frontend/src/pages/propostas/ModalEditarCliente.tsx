import { useState } from 'react'
import type { FormEvent } from 'react'
import { mascaraTelefone, validarEmail } from '../../utils/validacoes'
import type { Cliente } from '../clientes/types'

type Props = {
  cliente: Cliente
  onFechar: () => void
  onSalvo: (cliente: Cliente) => void
}

// Edição rápida durante a composição da proposta — só os campos mais comuns de
// precisar correção na hora (e-mail/telefone errados, endereço incompleto). Para
// edição completa (contatos, categoria etc.) ainda existe a tela /clientes/:id/editar.
export function ModalEditarCliente({ cliente, onFechar, onSalvo }: Props) {
  const [razaoSocial, setRazaoSocial] = useState(cliente.razao_social)
  const [nomeFantasia, setNomeFantasia] = useState(cliente.nome_fantasia ?? '')
  const [email, setEmail] = useState(cliente.email ?? '')
  const [telefone, setTelefone] = useState(cliente.telefone ? mascaraTelefone(cliente.telefone) : '')
  const [endereco, setEndereco] = useState(cliente.endereco ?? '')
  const [cidade, setCidade] = useState(cliente.cidade ?? '')
  const [uf, setUf] = useState(cliente.uf ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!razaoSocial.trim()) { setErro('Informe a razão social.'); return }
    if (email.trim() && !validarEmail(email.trim())) { setErro('E-mail inválido.'); return }

    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          razao_social: razaoSocial.trim(),
          nome_fantasia: nomeFantasia.trim() || null,
          email: email.trim() || null,
          telefone: telefone.replace(/\D/g, '') || null,
          endereco: endereco.trim() || null,
          cidade: cidade.trim() || null,
          uf: uf.trim().toUpperCase() || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar cliente.'); return }
      onSalvo(d.cliente)
    } catch {
      setErro('Erro de conexão ao salvar cliente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-cabecalho">
          <h3>Editar cliente</h3>
          <button className="modal-fechar" type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={salvar}>
          {erro && <p className="alerta-erro" role="alert">{erro}</p>}

          <div className="campo">
            <label htmlFor="modal-razao-social">Razão social *</label>
            <input id="modal-razao-social" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} required />
          </div>

          <div className="campo">
            <label htmlFor="modal-nome-fantasia">Nome fantasia</label>
            <input id="modal-nome-fantasia" value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
          </div>

          <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="campo">
              <label htmlFor="modal-email">E-mail</label>
              <input id="modal-email" className="sem-uppercase" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="modal-telefone">Telefone</label>
              <input id="modal-telefone" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} maxLength={15} />
            </div>
          </div>

          <div className="campo">
            <label htmlFor="modal-endereco">Endereço</label>
            <input id="modal-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </div>

          <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 80px' }}>
            <div className="campo">
              <label htmlFor="modal-cidade">Cidade</label>
              <input id="modal-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="modal-uf">UF</label>
              <input id="modal-uf" value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} />
            </div>
          </div>

          <div className="barra-acoes-formulario">
            <button className="botao" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            <button className="botao-secundario" type="button" onClick={onFechar}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
