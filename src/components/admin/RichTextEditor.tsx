'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Bold, Italic, Heading2, Heading3, List, Link2 } from 'lucide-react'
import styles from './RichTextEditor.module.css'

interface RichTextEditorProps {
  value:    string
  onChange: (html: string) => void
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: styles.content },
    },
  })

  // Sincroniza cambios externos de `value` (ej. carga async del post en edición)
  // sin pisar lo que el usuario está escribiendo — solo si el HTML difiere.
  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false })
  }, [value, editor])

  if (!editor) return null

  function toggleLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('URL del enlace:')
    if (!url) return
    editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formato de texto">
        <button
          type="button"
          className={`${styles.btn} ${editor.isActive('bold') ? styles.btnActive : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Negrita"
          aria-pressed={editor.isActive('bold')}
        >
          <Bold size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${editor.isActive('italic') ? styles.btnActive : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Cursiva"
          aria-pressed={editor.isActive('italic')}
        >
          <Italic size={15} aria-hidden="true" />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button
          type="button"
          className={`${styles.btn} ${editor.isActive('heading', { level: 2 }) ? styles.btnActive : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Encabezado 2"
          aria-pressed={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${editor.isActive('heading', { level: 3 }) ? styles.btnActive : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Encabezado 3"
          aria-pressed={editor.isActive('heading', { level: 3 })}
        >
          <Heading3 size={15} aria-hidden="true" />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button
          type="button"
          className={`${styles.btn} ${editor.isActive('bulletList') ? styles.btnActive : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Lista"
          aria-pressed={editor.isActive('bulletList')}
        >
          <List size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${editor.isActive('link') ? styles.btnActive : ''}`}
          onClick={toggleLink}
          aria-label="Enlace"
          aria-pressed={editor.isActive('link')}
        >
          <Link2 size={15} aria-hidden="true" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
