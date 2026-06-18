import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { useEffect, useState } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

// Páginas HTML completas (com <!DOCTYPE>, <html>, <head> ou <style>) não podem ser
// representadas pelo editor visual sem perda — o TipTap descarta tags/atributos que
// não conhece (head, style, div com classes, etc.). Nesses casos travamos em modo
// HTML puro, sem nunca passar o conteúdo pelo parser do editor.
function ehPaginaCompleta(html: string): boolean {
  return /<!DOCTYPE|<html[\s>]|<head[\s>]|<style[\s>]/i.test(html)
}

export function EditorHtml({ value, onChange, placeholder }: Props) {
  const [modoHtml, setModoHtml] = useState(() => ehPaginaCompleta(value))
  const [htmlBruto, setHtmlBruto] = useState(value)
  const travadoEmHtml = ehPaginaCompleta(htmlBruto)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: modoHtml ? '' : value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'editor-html-conteudo' },
    },
  })

  // sincroniza quando o value muda externamente (ex.: carregar template)
  useEffect(() => {
    if (ehPaginaCompleta(value)) {
      setHtmlBruto(value)
      setModoHtml(true)
      return
    }
    if (editor && !modoHtml && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor, modoHtml])

  function alternarModo() {
    if (!editor) return
    if (modoHtml) {
      if (ehPaginaCompleta(htmlBruto)) {
        // página completa: aplica direto, sem passar pelo editor (evitaria perda de conteúdo)
        onChange(htmlBruto)
      } else {
        editor.commands.setContent(htmlBruto || '')
        onChange(editor.getHTML())
      }
    } else {
      setHtmlBruto(editor.getHTML())
    }
    setModoHtml((m) => !m)
  }

  function onChangeHtmlBruto(novoHtml: string) {
    setHtmlBruto(novoHtml)
    if (ehPaginaCompleta(novoHtml)) onChange(novoHtml)
  }

  if (!editor) return null

  function ativo(nome: string, attrs?: Record<string, unknown>) {
    return editor!.isActive(nome, attrs) ? ' ativo' : ''
  }

  function inserirLink() {
    const url = window.prompt('URL do link:')
    if (url) editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    else editor!.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  return (
    <div className="editor-html">
      <div className="editor-html-barra">
        {!modoHtml && (
          <>
            <button type="button" className={`editor-html-botao${ativo('bold')}`} onClick={() => editor.chain().focus().toggleBold().run()}>
              <strong>B</strong>
            </button>
            <button type="button" className={`editor-html-botao${ativo('italic')}`} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <em>I</em>
            </button>
            <button type="button" className={`editor-html-botao${ativo('underline')}`} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <s>S</s>
            </button>
            <span className="editor-html-separador" />
            <button type="button" className={`editor-html-botao${ativo('heading', { level: 2 })}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              H2
            </button>
            <button type="button" className={`editor-html-botao${ativo('heading', { level: 3 })}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              H3
            </button>
            <span className="editor-html-separador" />
            <button type="button" className={`editor-html-botao${ativo('bulletList')}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              • Lista
            </button>
            <button type="button" className={`editor-html-botao${ativo('orderedList')}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              1. Lista
            </button>
            <span className="editor-html-separador" />
            <button type="button" className={`editor-html-botao${ativo('link')}`} onClick={inserirLink}>
              🔗 Link
            </button>
            <button type="button" className="editor-html-botao" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
              Limpar
            </button>
          </>
        )}
        <span style={{ flex: 1 }} />
        {!travadoEmHtml && (
          <button type="button" className="editor-html-botao" onClick={alternarModo}>
            {modoHtml ? '✓ Aplicar HTML' : '</> Ver/editar HTML'}
          </button>
        )}
      </div>
      {modoHtml ? (
        <>
          {travadoEmHtml && (
            <p style={{ fontSize: '12px', color: 'var(--text)', padding: '8px 14px 0', margin: 0 }}>
              Este conteúdo é uma página HTML completa (com &lt;head&gt;/&lt;style&gt;) e será enviado exatamente como está, sem edição visual — o editor não consegue representar páginas completas sem perda de conteúdo.
            </p>
          )}
          <textarea
            className="editor-html-bruto sem-uppercase"
            value={htmlBruto}
            onChange={(e) => onChangeHtmlBruto(e.target.value)}
            placeholder="<p>Cole ou edite o HTML aqui...</p>"
          />
        </>
      ) : (
        <EditorContent editor={editor} placeholder={placeholder} />
      )}
    </div>
  )
}
