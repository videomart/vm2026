import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { useEffect, useState } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function EditorHtml({ value, onChange, placeholder }: Props) {
  const [modoHtml, setModoHtml] = useState(false)
  const [htmlBruto, setHtmlBruto] = useState(value)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'editor-html-conteudo' },
    },
  })

  // sincroniza quando o value muda externamente (ex.: carregar template)
  useEffect(() => {
    if (editor && !modoHtml && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor, modoHtml])

  function alternarModo() {
    if (!editor) return
    if (modoHtml) {
      // voltando do HTML para visual: aplica o texto editado
      editor.commands.setContent(htmlBruto || '')
      onChange(editor.getHTML())
    } else {
      setHtmlBruto(editor.getHTML())
    }
    setModoHtml((m) => !m)
  }

  if (!editor) return null

  function ativo(nome: string, attrs?: Record<string, unknown>) {
    return editor.isActive(nome, attrs) ? ' ativo' : ''
  }

  function inserirLink() {
    const url = window.prompt('URL do link:')
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    else editor.chain().focus().extendMarkRange('link').unsetLink().run()
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
        <button type="button" className="editor-html-botao" onClick={alternarModo}>
          {modoHtml ? '✓ Aplicar HTML' : '</> Ver/editar HTML'}
        </button>
      </div>
      {modoHtml ? (
        <textarea
          className="editor-html-bruto sem-uppercase"
          value={htmlBruto}
          onChange={(e) => setHtmlBruto(e.target.value)}
          placeholder="<p>Cole ou edite o HTML aqui...</p>"
        />
      ) : (
        <EditorContent editor={editor} placeholder={placeholder} />
      )}
    </div>
  )
}
