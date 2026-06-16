// Retorna apenas dígitos de uma string
function digitos(s: string): string {
  return s.replace(/\D/g, '')
}

// CPF — algoritmo dos dois dígitos verificadores
export function validarCPF(valor: string): boolean {
  const d = digitos(valor)
  if (d.length !== 11 || /^(.)\1+$/.test(d)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i)
  let r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== Number(d[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i)
  r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === Number(d[10])
}

// CNPJ — algoritmo dos dois dígitos verificadores
export function validarCNPJ(valor: string): boolean {
  const d = digitos(valor)
  if (d.length !== 14 || /^(.)\1+$/.test(d)) return false
  const calc = (n: number) => {
    let soma = 0
    let pos = n - 7
    for (let i = 0; i < n; i++) {
      soma += Number(d[i]) * pos--
      if (pos < 2) pos = 9
    }
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

// Aceita CPF ou CNPJ
export function validarCNPJouCPF(valor: string): boolean {
  const d = digitos(valor)
  if (d.length === 11) return validarCPF(valor)
  if (d.length === 14) return validarCNPJ(valor)
  return false
}

// Telefone brasileiro: (DDD) + 8 ou 9 dígitos = 10 ou 11 dígitos no total
export function validarTelefone(valor: string): boolean {
  const d = digitos(valor)
  return d.length === 10 || d.length === 11
}

// E-mail simples (sem regex de RFCs)
export function validarEmail(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
}

// CEP: 8 dígitos
export function validarCEP(valor: string): boolean {
  return digitos(valor).length === 8
}

// --- Máscaras (formatam ao digitar) ---

export function mascaraCPF(valor: string): string {
  const d = digitos(valor).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function mascaraCNPJ(valor: string): string {
  const d = digitos(valor).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function mascaraCNPJouCPF(valor: string): string {
  const d = digitos(valor)
  if (d.length <= 11) return mascaraCPF(valor)
  return mascaraCNPJ(valor)
}

export function mascaraTelefone(valor: string): string {
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

export function mascaraCEP(valor: string): string {
  const d = digitos(valor).slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}
