# Conduit documentation site (Docusaurus)

Исходники страниц лежат в [`../docs`](../docs); этот пакет только собирает их в статический сайт.

## Команды

Из корня монорепозитория:

```bash
pnpm docs:dev    # dev-сервер http://localhost:3000
pnpm docs:build  # production-сборка → website/build
pnpm docs:serve  # проверка сборки локально
```

Из каталога `website/`:

```bash
pnpm start
pnpm build
pnpm serve
```

## Деплой

В `docusaurus.config.ts` заданы `url` и `baseUrl`. Для GitHub Pages проекта обычно задают, например, `url: 'https://<user>.github.io'` и `baseUrl: '/conduit/'`, затем публикуют содержимое `website/build` в ветку `gh-pages` или через Actions.

## Правки контента

Редактируйте Markdown в `docs/guides/` и `docs/architecture/` — сайт подхватывает их напрямую (`path: '../docs'`). Файл `docs/README.md` в сайт не включается (`exclude`), чтобы не дублировать навигацию с боковой панелью.
