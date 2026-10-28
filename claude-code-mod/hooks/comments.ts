// Разбор комментариев плагина Obsidian «Agent Comments» (id inline-comments).
// Грамматика плагина (src/parser.ts): {==фрагмент==}{>>автор|дата|тип: текст<<}…
// Блоки {>>…<<} идут подряд сразу после ==}. Старый формат {>>автор|дата: текст<<} = тип note.

export type Comment = {
  path: string
  highlight: string
  author: string
  date: string
  type: string
  text: string
  /** path\0author\0date\0type\0text. Без фрагмента: Accept у suggest меняет {==…==}, а записи треда остаются теми же. */
  key: string
}

/** Имя, которым сессия подписывает свои записи. */
export const AGENT_AUTHOR = 'Claude'

/** Типы без текста для ответа: решение по suggest, закрытие треда, реакция. Свои записи отсекает фильтр по автору. */
const CLOSED_TYPES = new Set(['accepted', 'declined', 'resolve', 'react'])

const FULL_RE = /\{==([\s\S]+?)==\}((?:\{>>[\s\S]+?<<\})+)/g
const BLOCK_RE = /\{>>([\s\S]+?)<<\}/g
const TYPED_RE = /^([^|]+)\|([^|]+)\|([^:]+):\s*([\s\S]*)$/
const UNTYPED_RE = /^([^|]+)\|([^:]+):\s*([\s\S]*)$/

export function parseComments(path: string, text: string): Comment[] {
  const out: Comment[] = []
  for (const m of text.matchAll(FULL_RE)) {
    const highlight = m[1] ?? ''
    for (const b of (m[2] ?? '').matchAll(BLOCK_RE)) {
      const raw = b[1] ?? ''
      let author = 'unknown'
      let date = ''
      let type = 'note'
      let body = raw
      const typed = raw.match(TYPED_RE)
      const untyped = typed ? null : raw.match(UNTYPED_RE)
      if (typed) {
        author = typed[1] ?? author
        date = typed[2] ?? date
        type = typed[3] ?? type
        body = typed[4] ?? ''
      } else if (untyped) {
        author = untyped[1] ?? author
        date = untyped[2] ?? date
        body = untyped[3] ?? ''
      }
      author = author.trim()
      date = date.trim()
      type = type.trim()
      body = body.trim()
      out.push({
        path,
        highlight,
        author,
        date,
        type,
        text: body,
        // ponytail: два одинаковых текста одного автора в один день на разных фрагментах сольются в один ключ;
        // добавить индекс треда, если это случится на практике
        key: [path, author, date, type, body].join('\0'),
      })
    }
  }
  return out
}

/** Новые записи от людей; все ключи (и свои, и чужие) помечаются виденными. */
export function pickNew(entries: Comment[], seen: Set<string>): Comment[] {
  const fresh: Comment[] = []
  for (const c of entries) {
    if (seen.has(c.key)) continue
    seen.add(c.key)
    if (c.author === AGENT_AUTHOR || CLOSED_TYPES.has(c.type)) continue
    fresh.push(c)
  }
  return fresh
}

export function buildPrompt(path: string, entries: Comment[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const items = entries
    .map(
      (c, i) =>
        `${i + 1}. Фрагмент: «${c.highlight}»\n   ${c.author} (${c.type}, ${c.date}): ${c.text}`,
    )
    .join('\n')
  return [
    `📬 Новые комментарии в Obsidian к файлу ${path} (${entries.length}):`,
    items,
    '',
    'Как ответить: открой файл, найди блок этого фрагмента вида {==фрагмент==}{>>автор|дата|тип: текст<<}',
    `и сразу после последнего <<} этого блока допиши одну запись: {>>${AGENT_AUTHOR}|${today}|reply: твой ответ<<}`,
    `Если нужно заменить сам фрагмент, добавь отдельную запись: {>>${AGENT_AUTHOR}|${today}|suggest: только новый текст<<}`,
    'Фрагмент {==…==} меняется только когда пользователь нажмёт Accept — сам его не правь.',
    'Правила: чужие записи и {==…==} не удалять и не менять; в тексте ответа не использовать << и >>;',
    'отвечать по существу, при необходимости прочитать файл; после записи пользователь увидит ответ в панели комментариев.',
  ].join('\n')
}
