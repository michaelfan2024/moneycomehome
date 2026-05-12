# Raphael Publish Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users preselect a Raphael Publish theme while generating an AI report, then land directly in the WeChat editor with that theme applied while retaining post-generation theme switching.

**Architecture:** Keep AI content generation and visual formatting separate. Add small pure helpers for theme validation and editor URL construction, then wire them into the report generation page and WeChat editor query-param initialization.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS, Vitest, existing Raphael editor modules.

---

## File Structure

- Create: `src/lib/wechat-editor/themeSelection.ts`
  - Owns safe theme id lookup and editor URL construction.
- Create: `src/lib/wechat-editor/themeSelection.test.ts`
  - Tests the helper behavior without rendering React.
- Modify: `src/app/report/generate/GenerateReportContent.tsx`
  - Adds selected Raphael theme state and UI.
  - Navigates to `/wechat-editor?reportId=<id>&theme=<themeId>` after generation.
- Modify: `src/app/wechat-editor/WechatEditorContent.tsx`
  - Reads `theme` from search params and initializes/falls back safely.
- Optionally modify: `src/lib/wechat-editor/htmlToMarkdown.ts`, `imageSelector.ts`, `indexerRules.ts`, `markdown.ts`, `wechatCompat.ts`
  - Bring over lint/type cleanups from `raphael-publish-main` if they are needed by verification.
- Optionally create: `src/types/turndown-plugin-gfm.d.ts`
  - Only if TypeScript build needs the module declaration in this target app.

## Task 1: Theme Selection Helpers

**Files:**
- Create: `src/lib/wechat-editor/themeSelection.ts`
- Create: `src/lib/wechat-editor/themeSelection.test.ts`

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run helper test and verify it fails**
- [ ] **Step 3: Implement helper**
- [ ] **Step 4: Run helper test and verify it passes**

## Task 2: Wire Theme Preselection Into Report Generation

**Files:**
- Modify: `src/app/report/generate/GenerateReportContent.tsx`

- [ ] **Step 1: Add theme imports**
- [ ] **Step 2: Add selected theme state**
- [ ] **Step 3: Update successful generation navigation to `/wechat-editor?reportId=<id>&theme=<themeId>`**
- [ ] **Step 4: Add pre-generation theme UI after the report template selector**
- [ ] **Step 5: Run tests**

## Task 3: Initialize WeChat Editor From Theme Query Param

**Files:**
- Modify: `src/app/wechat-editor/WechatEditorContent.tsx`

- [ ] **Step 1: Import `getSafeThemeId`**
- [ ] **Step 2: Read `theme` query param**
- [ ] **Step 3: Initialize active theme from safe query param**
- [ ] **Step 4: Keep in-editor switching unchanged**
- [ ] **Step 5: Run tests**

## Task 4: Sync Embedded Raphael Utilities With Clean Source If Needed

**Files:**
- Modify as needed:
  - `src/lib/wechat-editor/htmlToMarkdown.ts`
  - `src/lib/wechat-editor/imageSelector.ts`
  - `src/lib/wechat-editor/indexerRules.ts`
  - `src/lib/wechat-editor/markdown.ts`
  - `src/lib/wechat-editor/wechatCompat.ts`
- Create if needed:
  - `src/types/turndown-plugin-gfm.d.ts`

- [ ] **Step 1: Run build**
- [ ] **Step 2: Apply minimal cleanup only when required**
- [ ] **Step 3: Run build again**

## Task 5: Final Verification

- [ ] **Step 1: Run `pnpm test`**
- [ ] **Step 2: Run `pnpm build`**
- [ ] **Step 3: Manual browser verification**

## Notes

- This workspace is not a git repository, so commit steps are intentionally omitted.
- The plan avoids persisting theme metadata on reports for the first pass. URL-based initialization is enough for the approved workflow and avoids report schema churn.
