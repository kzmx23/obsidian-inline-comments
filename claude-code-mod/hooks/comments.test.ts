import { expect, test } from 'claude-code/testing'

import { buildPrompt, parseComments, pickNew } from './comments'

const DOC = [
  '# Документ',
  '',
  'Текст {==первый фрагмент==}{>>Иван|2026-10-28|question: Откуда это?<<} дальше.',
  'Ещё {==второй==}{>>Иван|2026-10-27|note: пометка<<}{>>Claude|2026-10-28|reply: ответ<<} текст.',
  'Старый {==третий==}{>>Иван|2026-10-26: без типа<<}.',
].join('\n')

test('две записи подряд за одним {==…==} дают две записи', async () => {
  const all = parseComments('C:/v/doc.md', DOC)
  expect(all.length).toBe(4)
  expect(all[1]?.highlight).toBe('второй')
  expect(all[2]?.highlight).toBe('второй')
  expect(all[2]?.author).toBe('Claude')
  expect(all[2]?.type).toBe('reply')
})

test('старый формат автор|дата: текст читается как note', async () => {
  const old = parseComments('C:/v/doc.md', DOC)[3]
  expect(old?.author).toBe('Иван')
  expect(old?.date).toBe('2026-10-26')
  expect(old?.type).toBe('note')
  expect(old?.text).toBe('без типа')
})

test('новый question от человека находится, reply от Claude — нет', async () => {
  const fresh = pickNew(parseComments('C:/v/doc.md', DOC), new Set())
  const types = fresh.map(c => `${c.author}:${c.type}`)
  expect(types).toEqual(['Иван:question', 'Иван:note', 'Иван:note'])
})

test('reply и suggest от человека будят, declined/resolve/react — нет', async () => {
  const doc =
    '{==a==}{>>Иван|2026-10-28|reply: а почему?<<}{>>Иван|2026-10-28|suggest: иначе<<}' +
    '{>>Claude|2026-10-28|declined: x<<}{>>Иван|2026-10-28|resolve: <<}{>>Иван|2026-10-28|react: 👍 #1<<}'
  const fresh = pickNew(parseComments('C:/v/d.md', doc), new Set())
  expect(fresh.map(c => c.type)).toEqual(['reply', 'suggest'])
})

test('Accept у suggest меняет фрагмент — старые записи треда новыми не считаются', async () => {
  const before = '{==**Кто.** ==}{>>Иван|2026-10-28|agree: это чё?<<}{>>Claude|2026-10-28|suggest: **Пользователь.** <<}'
  const after = '{==**Пользователь.** ==}{>>Иван|2026-10-28|agree: это чё?<<}{>>Claude|2026-10-28|accepted: **Пользователь.** <<}'
  const seen = new Set<string>()
  expect(pickNew(parseComments('C:/v/d.md', before), seen).length).toBe(1)
  expect(pickNew(parseComments('C:/v/d.md', after), seen).length).toBe(0)
})

test('повторный разбор того же файла ничего не даёт', async () => {
  const seen = new Set<string>()
  const first = pickNew(parseComments('C:/v/doc.md', DOC), seen)
  expect(first.length).toBe(3)
  const again = pickNew(parseComments('C:/v/doc.md', DOC), seen)
  expect(again.length).toBe(0)
})

test('промпт несёт путь, цитату, вопрос и контракт ответа', async () => {
  const fresh = pickNew(parseComments('C:/v/doc.md', DOC), new Set()).slice(0, 1)
  const text = buildPrompt('C:/v/doc.md', fresh)
  expect(text.includes('C:/v/doc.md')).toBe(true)
  expect(text.includes('первый фрагмент')).toBe(true)
  expect(text.includes('Откуда это?')).toBe(true)
  expect(text.includes('{>>Claude|')).toBe(true)
  expect(text.includes('|reply: ')).toBe(true)
  expect(text.includes('|suggest: ')).toBe(true)
})
