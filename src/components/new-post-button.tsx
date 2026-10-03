import { createPost } from '@/actions/posts'

/** FR-020: membuat artikel harus ≤ 1 interaksi dari dashboard. */
export function NewPostButton() {
  return (
    <form action={createPost}>
      <button
        type="submit"
        className="rounded-md border px-4 py-2 text-sm font-medium"
        style={{ background: 'var(--accent)', color: 'white', borderColor: 'transparent' }}
      >
        Tulis artikel baru
      </button>
    </form>
  )
}
