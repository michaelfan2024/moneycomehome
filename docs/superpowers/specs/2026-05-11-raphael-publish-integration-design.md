# Raphael Publish Integration Design

## Goal

Integrate Raphael Publish as a first-class publishing workflow inside Money Come Home. Users can write directly in the WeChat editor, or generate an AI stock report and send it into the Raphael-style editor for final formatting, copying, and export.

## Approved Workflow

The AI report generation page keeps its existing report content template selector. It also adds a Raphael Publish layout theme selector before generation.

When the user clicks "开始生成报告":

1. Money Come Home generates the AI report markdown using the selected content template.
2. The generated report is saved as before.
3. The selected Raphael theme id is passed to the WeChat editor route.
4. The app navigates directly to `/wechat-editor?reportId=<id>&theme=<themeId>`.
5. The editor loads the report markdown and initializes with the selected theme.
6. The user can still switch among all Raphael Publish themes after generation without regenerating the report.

## Scope

In scope:

- Preserve the existing standalone `/wechat-editor` tool.
- Preserve loading generated reports via `reportId`.
- Add pre-generation Raphael theme selection on `src/app/report/generate/GenerateReportContent.tsx`.
- Initialize `src/app/wechat-editor/WechatEditorContent.tsx` from a `theme` query parameter.
- Keep post-generation theme switching in the editor.
- Add tests around theme selection URL flow and query-param theme initialization.
- Bring the embedded editor utilities up to the cleaned Raphael source where differences are lint/type cleanups or missing tests.

Out of scope:

- Changing AI prompt semantics based on the visual theme.
- Permanently binding a report to one visual theme.
- Building direct WeChat API publishing.
- Reworking the broader Money Come Home navigation or stock analysis model.

## Data Flow

Theme selection is presentation metadata, not AI content. The selected theme is held in client state during report generation and passed as a URL query parameter after the report is created.

The report store does not need a schema migration for the initial integration because the editor can initialize from `theme` and the user can change themes freely. Persisting preferred themes can be added later if needed.

## UX Requirements

- The generation page should show a compact "公众号排版风格" section after the report template selector.
- The default theme is `THEMES[0]`, matching the existing Raphael editor default.
- The selector should use the existing Raphael theme definitions so names/descriptions stay consistent.
- The selected theme should be visually clear before generation.
- After generation, users land directly in the WeChat editor with the selected theme applied.
- If an invalid theme id appears in the URL, the editor falls back to the default theme.

## Testing Requirements

- Unit test a helper that validates theme ids and returns the safe default.
- Unit test a helper that builds the post-generation editor URL.
- Component tests are not required for the first pass unless the existing test setup makes them cheap.
- Run `pnpm test` and `pnpm build`.

## Constraints

- The target project is not currently a git repository, so changes cannot be committed from this workspace.
- The existing `money come home` project already contains a partial Raphael integration under `src/app/wechat-editor`, `src/components/wechat-editor`, and `src/lib/wechat-editor`.
- Keep the implementation small and follow the current Next.js App Router structure.
