# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NSDA Debate Card Cutter - A full-stack SvelteKit application that helps debate students format evidence citations and apply customizable text highlighting. The app extracts metadata from URLs, allows multi-level text highlighting, and outputs rich text (HTML) that preserves formatting when copied to Word/Google Docs.

## Technology Stack

- **SvelteKit 2** with **Svelte 5 (runes syntax)** - Use `$state`, `$derived`, `$props`, `$bindable`
- **TypeScript** - All source files use TS
- **Tailwind CSS 4** - Utility-first styling
- **Vite 7** - Build tool
- **adapter-vercel** - Configured for Vercel deployment with serverless functions

## Development Commands

```bash
npm run dev          # Start dev server (usually http://localhost:5173)
npm run build        # Build for production (outputs to build/)
npm run preview      # Preview production build
npm run check        # Type-check with svelte-check
npm run check:watch  # Type-check in watch mode
npm run format       # Format code with Prettier
npm run lint         # Lint with Prettier and ESLint
npm run test         # Run Playwright e2e tests
```

## Architecture

### Full-Stack Configuration

- **`src/routes/+layout.ts`**: Exports `prerender = true` for static page generation with SSR enabled
- **`svelte.config.js`**: Uses `adapter-vercel` for Vercel deployment
- **`vercel.json`**: Vercel deployment configuration
- **`src/routes/api/extract-metadata/+server.ts`**: Serverless API endpoint for URL fetching (bypasses CORS)

### State Management

**Highlight configuration** is managed via Svelte 5 runes in a class-based store pattern:

- **`src/lib/stores/highlightConfig.svelte.ts`**:
  - Exports `highlightConfig` singleton instance
  - Uses `$state` rune for reactive highlight levels array
  - Persists to `localStorage` (key: `cardcutter_highlight_levels`)
  - Methods: `updateLevel()`, `addLevel()`, `removeLevel()`, `resetToDefaults()`

### Core Data Flow

1. **URL Metadata Extraction**:
   - **Client** (`src/lib/utils/metadataExtractor.ts`): Calls `/api/extract-metadata` endpoint
   - **Server** (`src/routes/api/extract-metadata/+server.ts`): Fetches article HTML and parses Open Graph/meta tags using regex (no CORS issues)
   - Extracts: title, author, publisher, date
   - Falls back to AI extraction (client-side with BYOK) if author is missing

2. **AI Metadata Extraction** (`src/lib/utils/aiMetadataExtractor.ts`):
   - **Client-side only** - uses user-provided API keys (BYOK model)
   - Supports OpenAI, Anthropic, and Google AI providers
   - Uses Vercel AI SDK (`ai` package) with `generateText()`
   - Only used when standard extraction fails to find author

3. **Text Highlighting** (`CardCutter.svelte`):
   - Maintains `textSegments` array mapping character positions to highlight levels
   - `applyHighlight()` uses a `Map<position, highlightLevel>` to merge new highlights with existing ones
   - **Critical**: Highlights are position-based and preserved when applying overlapping highlights (e.g., highlighting different parts of the same word)

4. **Rich Text Output** (`src/lib/utils/clipboard.ts`):
   - Generates HTML with inline styles (Calibri 12pt, bold/underline/colors per highlight level)
   - Uses `navigator.clipboard.write()` with `ClipboardItem` containing both `text/html` and `text/plain`
   - Falls back to plain text if clipboard API fails

### Citation Format

NSDA format (see `generateCitationHtml()` in `CardCutter.svelte`):
```
**FirstName** LastName (**Qualifications**); Date [*Article Title*; Source; URL; DOA DateOfAccess //Code]
```

Key details:
- First name is **bold**
- Qualifications in parentheses, also **bold**
- Article title in *italics*
- All rendered as inline HTML with `<strong>` and `<em>` tags

### Component Structure

- **`src/routes/+page.svelte`**: Main page with `CardCutter` component and highlight config modal toggle
- **`src/lib/components/CardCutter.svelte`**: Main interface with:
  - Citation form (URL input triggers metadata extraction on blur)
  - Evidence text area (tracks selection for highlighting)
  - Highlight level buttons (disabled when no text selected)
  - Preview and copy-to-clipboard button (disabled if `!sourceText || !citation.firstName`)
- **`src/lib/components/HighlightConfig.svelte`**: Modal for configuring highlight levels with live preview

### Type Definitions

All types in `src/lib/types.ts`:
- **`CitationData`**: All citation fields (firstName, lastName, qualifications, date, articleTitle, source, url, dateOfAccess, code)
- **`HighlightLevel`**: Highlight configuration (id, name, bold, underline, fontSize, backgroundColor, color)
- **`TextSegment`**: Text chunk with optional highlight level reference

## Key Implementation Details

### Highlight Merging Algorithm

When applying highlights (in `applyHighlight()`):
1. Build a Map from existing `textSegments` (position → highlightLevel)
2. Overwrite only the selected character positions with the new level
3. Rebuild segments by iterating through the map and consolidating consecutive characters with the same level

This ensures existing highlights are preserved outside the selection.

### Deployment

- **Platform**: Vercel (configured via `vercel.json` and `adapter-vercel`)
- **Serverless Functions**: API routes in `src/routes/api/*` are deployed as Vercel serverless functions
- **Environment**: Production uses npm for builds
- **Note**: The old GitHub Actions workflow (`.github/workflows/deploy.yml`) for GitHub Pages is no longer used

### Browser APIs Used

- **Clipboard API**: `navigator.clipboard.write()` with `ClipboardItem`
- **LocalStorage**: Persisting highlight configuration
- **DOMParser**: Parsing fetched HTML for metadata extraction
- **TextArea selection**: `selectionStart` and `selectionEnd` for highlight application
