declare module 'claude-code' {
  interface PluginState {
    'obsidian-comments-wake': {
      /** Абсолютные пути .md под vault, которые сессия писала (Write/Edit). */
      watched: Shaped<string[]>
      /** Ключи уже виденных записей комментариев: path\0highlight\0author\0date\0text. */
      seen: Shaped<string[]>
    }
  }
}
