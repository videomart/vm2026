function digitos(s: string): string {
  return s.replace(/\D/g, '')
}

export function formatarCNPJ(valor: string): string {
  const d = digitos(valor).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatarCPF(valor: string): string {
  const d = digitos(valor).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function formatarCNPJCPF(valor: string): string {
  const d = digitos(valor)
  if (d.length <= 11) return formatarCPF(valor)
  return formatarCNPJ(valor)
}

export function formatarTelefone(valor: string): string {
  const d = digitos(valor).slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function formatarCEP(valor: string): string {
  const d = digitos(valor).slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

export function formatarMoeda(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '—'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Formata um campo DATE do MySQL (string "YYYY-MM-DD" ou ISO "YYYY-MM-DDT...Z")
 * sem conversão de fuso — usa os dígitos literais da string.
 */
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return '—'
  const s = String(valor).slice(0, 10) // "YYYY-MM-DD"
  const [ano, mes, dia] = s.split('-')
  if (!ano || !mes || !dia) return valor
  return `${dia}/${mes}/${ano}`
}

/** Extrai "YYYY-MM-DD" de um campo DATE do MySQL, para usar em input[type=date] */
export function dataParaInput(valor: string | null | undefined): string {
  if (!valor) return ''
  return String(valor).slice(0, 10)
}
