import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatarData } from '../../utils/formatar'
import type { Proposta } from './types'

type Empresa = {
  empresa_nome: string
  empresa_cnpj: string | null
  empresa_endereco: string | null
  empresa_telefone: string | null
  empresa_email: string | null
  empresa_site: string | null
}

function fmt(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function stripHtml(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const fmtData = formatarData

export function ImpressaoProposta() {
  const { id } = useParams()
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/propostas/${id}`, { credentials: 'include' }),
      fetch('/api/setup', { credentials: 'include' }),
      fetch('/api/setup/logo', { credentials: 'include' }),
    ])
      .then(async ([rp, rs, rlo]) => {
        if (!rp.ok) return Promise.reject(rp.status)
        const [dp, ds] = await Promise.all([rp.json(), rs.ok ? rs.json() : Promise.resolve(null)])
        const p = dp.proposta
        if (p) {
          p.condicoes_pagamento = stripHtml(p.condicoes_pagamento)
          p.observacoes = stripHtml(p.observacoes)
        }
        setProposta(p)
        if (ds?.setup) setEmpresa(ds.setup)
        if (rlo.ok) {
          const blob = await rlo.blob()
          setLogoUrl(URL.createObjectURL(blob))
        }
      })
      .catch((e) => setErro(e === 401 ? 'Sessão expirada. Faça login novamente.' : 'Proposta não encontrada.'))
  }, [id])

  if (erro) return <div className="impressao-erro">{erro}</div>
  if (!proposta) return <div className="impressao-carregando">Carregando...</div>

  const p = proposta as any
  const itens = proposta.itens ?? []
  const subtotalItens = itens.reduce((s: number, i: any) => s + Number(i.subtotal), 0)
  const descGlobal = Number(proposta.desconto) || 0
  const total = Number(proposta.total) || subtotalItens - descGlobal

  return (
    <div className="impressao-pagina">
      {/* Barra de ações — oculta na impressão */}
      <div className="impressao-toolbar">
        <button className="botao" onClick={() => window.print()}>
          🖨 Imprimir / Salvar PDF
        </button>
        <button className="botao-secundario" onClick={() => window.close()}>
          Fechar
        </button>
      </div>

      {/* Documento */}
      <div className="impressao-documento">

        {/* Cabeçalho */}
        <div className="impressao-cabecalho">
          <div className="impressao-empresa">
            {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain', display: 'block', marginBottom: '4px' }} />}
            <strong>{empresa?.empresa_nome ?? 'Videomart Broadcast'}</strong>
            {empresa?.empresa_cnpj && <span>CNPJ: {empresa.empresa_cnpj}</span>}
            {empresa?.empresa_endereco && <span>{empresa.empresa_endereco}</span>}
            {empresa?.empresa_telefone && <span>Tel: {empresa.empresa_telefone}</span>}
            {empresa?.empresa_email && <span>{empresa.empresa_email}</span>}
            {empresa?.empresa_site && <span>{empresa.empresa_site}</span>}
          </div>
          <div className="impressao-titulo-bloco">
            <div className="impressao-titulo">PROPOSTA COMERCIAL</div>
            <table className="impressao-meta">
              <tbody>
                <tr>
                  <th>Nº</th>
                  <td>{proposta.id}</td>
                </tr>
                <tr>
                  <th>Data</th>
                  <td>{fmtData(proposta.data)}</td>
                </tr>
                {proposta.validade && (
                  <tr>
                    <th>Validade</th>
                    <td>{fmtData(proposta.validade)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <hr className="impressao-divisor" />

        {/* Cliente + Vendedor */}
        <div className="impressao-partes">
          <div className="impressao-parte">
            <div className="impressao-parte-titulo">CLIENTE</div>
            <strong>{p.cliente_nome}</strong>
            {p.cliente_fantasia && p.cliente_fantasia !== p.cliente_nome && (
              <span>{p.cliente_fantasia}</span>
            )}
            {p.cliente_cnpj_cpf && <span>CNPJ/CPF: {p.cliente_cnpj_cpf}</span>}
            {p.cliente_endereco && <span>{p.cliente_endereco}</span>}
            {(p.cliente_cidade || p.cliente_uf) && (
              <span>{[p.cliente_cidade, p.cliente_uf].filter(Boolean).join(' — ')}{p.cliente_cep ? ` — CEP ${p.cliente_cep}` : ''}</span>
            )}
            {p.cliente_telefone && <span>Tel: {p.cliente_telefone}</span>}
            {p.cliente_email && <span>{p.cliente_email}</span>}
          </div>
          <div className="impressao-parte">
            <div className="impressao-parte-titulo">VENDEDOR</div>
            <strong>{proposta.vendedor_nome}</strong>
            {p.vendedor_email && <span>{p.vendedor_email}</span>}
          </div>
        </div>

        {/* Itens */}
        <table className="impressao-tabela">
          <thead>
            <tr>
              <th className="col-item">#</th>
              <th>Descrição</th>
              <th className="col-num">Qtd</th>
              <th className="col-num">Valor Unit.</th>
              <th className="col-num">Desconto</th>
              <th className="col-num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item: any, idx: number) => (
              <tr key={item.id ?? idx}>
                <td className="col-item">{idx + 1}</td>
                <td>
                  {item.descricao}
                  {item.produto_modelo && item.produto_modelo !== item.descricao && (
                    <div className="impressao-modelo">{item.produto_modelo}</div>
                  )}
                </td>
                <td className="col-num">{Number(item.quantidade)}</td>
                <td className="col-num">{fmt(item.valor_unitario)}</td>
                <td className="col-num">{Number(item.desconto) > 0 ? fmt(item.desconto) : '—'}</td>
                <td className="col-num">{fmt(item.subtotal)}</td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>Sem itens</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totais */}
        <div className="impressao-totais">
          {descGlobal > 0 && (
            <>
              <div className="impressao-total-linha">
                <span>Subtotal</span>
                <span>{fmt(subtotalItens)}</span>
              </div>
              <div className="impressao-total-linha">
                <span>Desconto</span>
                <span>− {fmt(descGlobal)}</span>
              </div>
            </>
          )}
          <div className="impressao-total-linha impressao-total-final">
            <span>TOTAL</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

        {/* Rodapé: condições + observações */}
        {(proposta.condicoes_pagamento || proposta.observacoes) && (
          <div className="impressao-rodape-doc">
            {proposta.condicoes_pagamento && (
              <div className="impressao-rodape-item">
                <strong>Condições de pagamento:</strong>
                <span style={{ whiteSpace: 'pre-wrap' }}>{proposta.condicoes_pagamento}</span>
              </div>
            )}
            {proposta.observacoes && (
              <div className="impressao-rodape-item">
                <strong>Observações:</strong>
                <span style={{ whiteSpace: 'pre-wrap' }}>{proposta.observacoes}</span>
              </div>
            )}
          </div>
        )}

        <div className="impressao-assinatura">
          <div className="impressao-assinatura-linha">
            <div className="impressao-assinatura-bloco">
              <div className="impressao-assinatura-espaco" />
              <span>Videomart Broadcast</span>
            </div>
            <div className="impressao-assinatura-bloco">
              <div className="impressao-assinatura-espaco" />
              <span>Cliente / Aprovação</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
