import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { buildPrompt, parseComments, pickNew } from './comments'

const TICK_MS = 3000
const SEEN_CAP = 5000
// ponytail: под наблюдение идёт любой .md, который сессия писала, без привязки к vault;
// держим последние 50, чтобы опрос раз в 3 с оставался дешёвым
const WATCH_CAP = 50

const watched = atom({ plugin: 'obsidian-comments-wake', key: 'watched' } as const, [], {
  shape: 'watched-1',
})
// Тег формы менять при смене формата ключа: старые ключи отбрасываются, первый проход только запоминает.
const seen = atom({ plugin: 'obsidian-comments-wake', key: 'seen' } as const, [], {
  shape: 'seen-2',
})

const norm = (p: string) => p.replace(/\\/g, '/')

const isMd = (p: string) => norm(p).toLowerCase().endsWith('.md')

export const register: Register = on => {
  // .md, который сессия писала, попадает под наблюдение. Записи, что уже есть
  // в нём на момент записи, считаются виденными: будим только на новые.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.tool !== 'Write' && e.tool !== 'Edit') return ran
    if (ran.deny !== undefined || ran.isError === true || !isMd(e.file_path)) return ran
    const path = norm(e.file_path)
    let text = ''
    try {
      text = await $.fs.read(path)
    } catch {
      return ran
    }
    const keys = parseComments(path, text).map(c => c.key)
    await update($, seen, list => [...new Set([...list, ...keys])].slice(-SEEN_CAP))
    await update($, watched, list => [...list.filter(p => p !== path), path].slice(-WATCH_CAP))
    return ran
  })

  on('session.start', ($, e, next) => {
    let busy = false
    $.clock.every(TICK_MS, async () => {
      if (busy) return
      busy = true
      try {
        const paths = await read($, watched)
        if (paths.length === 0) return
        const known = new Set(await read($, seen))
        const before = known.size
        // Пустое состояние (первый запуск или смена формата ключей): запоминаем всё, никого не будим.
        const seeding = before === 0
        const prompts: string[] = []
        for (const path of paths) {
          let text = ''
          try {
            text = await $.fs.read(path)
          } catch {
            continue // ponytail: файл удалён или переименован — просто пропускаем
          }
          const fresh = pickNew(parseComments(path, text), known)
          if (fresh.length > 0 && !seeding) prompts.push(buildPrompt(path, fresh))
        }
        if (known.size === before) return
        await update($, seen, list => [...new Set([...list, ...known])].slice(-SEEN_CAP))
        for (const text of prompts) void $.prompt.submit({ text })
      } finally {
        busy = false
      }
    })
    return next(e)
  })
}
