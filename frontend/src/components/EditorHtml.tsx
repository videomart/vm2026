import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { useEffect } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function EditorHtml({ value, onChange, placeholder }: Props) {
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
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

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
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  )
}
