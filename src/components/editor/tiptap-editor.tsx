'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Editor Tiptap dengan keluaran Markdown — FR-030…FR-034.
 *
 * BRULE-15: sumber kebenaran isi artikel adalah MARKDOWN, bukan HTML. Tiptap
 * hanyalah permukaan penyuntingan; ekstensi Markdown memastikan yang tersimpan
 * tetap teks biasa yang portabel (BR-01).
 */
export function TiptapEditor({
  initialMarkdown,
  onChange,
  onWordCount,
}: {
  initialMarkdown: string
  onChange: (markdown: string) => void
  onWordCount?: (words: number) => void
}) {
  // Ref disinkronkan di effect, bukan saat render: menulis ref selama render
  // tidak aman terhadap render ulang yang dibatalkan.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    // Wajib false untuk App Router: mencegah ketidaksesuaian hidrasi SSR.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // FR-030: H1 dipesan untuk judul artikel.
        heading: { levels: [2, 3, 4] },
        link: false,
      }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }),
      Image.configure({ inline: false, allowBase64: false }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert max-w-none min-h-[28rem] focus:outline-none',
        'aria-label': 'Isi artikel',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const storage = ed.storage as unknown as { markdown: { getMarkdown: () => string } }
      const md = storage.markdown.getMarkdown()
      onChangeRef.current(md)
      onWordCount?.(countWords(md))
    },
  })

  useEffect(() => {
    if (editor && initialMarkdown && editor.isEmpty) {
      editor.commands.setContent(initialMarkdown)
    }
  }, [editor, initialMarkdown])

  const setLink = useCallback(() => {
    if (!editor) return
    const previous = editor.getAttributes('link')['href'] as string | undefined
    const url = window.prompt('URL tautan', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    // Hanya skema aman — selaras dengan sanitasi saat render (BRULE-18).
    if (!/^(https?:|mailto:)/i.test(url)) {
      window.alert('Hanya tautan http, https, atau mailto yang diizinkan.')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) {
    return <div className="min-h-[28rem] rounded-lg border p-4 text-sm">Memuat editor…</div>
  }

  return (
    <div className="rounded-lg border">
      <div
        role="toolbar"
        aria-label="Format teks"
        className="flex flex-wrap gap-1 border-b p-2"
        style={{ background: 'var(--bg-subtle)' }}
      >
        <Btn
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="Heading 2"
        >
          H2
        </Btn>
        <Btn
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          label="Heading 3"
        >
          H3
        </Btn>
        <Btn
          active={editor.isActive('heading', { level: 4 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          label="Heading 4"
        >
          H4
        </Btn>
        <Sep />
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Tebal">
          <strong>B</strong>
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Miring">
          <em>I</em>
        </Btn>
        <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} label="Coret">
          <s>S</s>
        </Btn>
        <Btn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} label="Kode sebaris">
          {'<>'}
        </Btn>
        <Sep />
        <Btn
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Daftar tak berurut"
        >
          •
        </Btn>
        <Btn
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Daftar berurut"
        >
          1.
        </Btn>
        <Btn
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Kutipan"
        >
          ❝
        </Btn>
        <Btn
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          label="Blok kode"
        >
          {'{ }'}
        </Btn>
        <Sep />
        <Btn active={editor.isActive('link')} onClick={setLink} label="Tautan">
          Tautan
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Garis pemisah">
          ―
        </Btn>
      </div>

      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function Btn({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active ?? false}
      title={label}
      className="min-w-8 rounded px-2 py-1 text-sm hover:bg-[var(--bg)]"
      style={active ? { background: 'var(--bg)', fontWeight: 600 } : undefined}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span aria-hidden="true" className="mx-1 w-px self-stretch" style={{ background: 'var(--border)' }} />
}

function countWords(md: string): number {
  return md.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}
