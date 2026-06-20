import { useEffect, useRef, useState } from 'react'

// Detecta se o elemento referenciado tem mais conteúdo horizontal do que cabe
// na tela — usado para mostrar uma dica visual de "role para o lado" em
// tabelas largas, já que a barra de scroll nativa fica escondida por padrão
// em macOS/mobile até o usuário interagir.
export function useOverflowHorizontal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [temOverflow, setTemOverflow] = useState(false)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    function verificar() {
      if (!elemento) return
      setTemOverflow(elemento.scrollWidth > elemento.clientWidth + 1)
    }

    verificar()
    const observer = new ResizeObserver(verificar)
    observer.observe(elemento)
    return () => observer.disconnect()
  }, [])

  return { ref, temOverflow }
}
