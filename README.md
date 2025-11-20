# Card Cutter

A browser extension and web application for creating properly formatted debate evidence cards with citations.

## Features

- **Zotero-Powered Metadata Extraction**: Uses Zotero translators for accurate extraction from thousands of websites
- **AI-Enhanced Qualifications**: Optional AI integration to extract author credentials and affiliations
- **Multi-Level Text Highlighting**: Customizable highlight levels for emphasis in evidence
- **NSDA Citation Format**: Automatically formats citations for National Speech & Debate Association standards
- **Rich Text Output**: Copy formatted cards directly to Word, Google Docs, or any rich text editor

## Getting Started

### Browser Extension

The extension provides the best experience with automatic page detection and seamless copying.

See [ZOTERO_SETUP.md](./ZOTERO_SETUP.md) for instructions on setting up Zotero translation-server for metadata extraction.

### Web Application

See [./packages/old-frontend](./packages/old-frontend) for the original web application (currently being migrated).

## Architecture

This is a monorepo with three packages:

- **packages/webextension**: Browser extension built with WXT and Svelte 5
- **packages/shared**: Shared library with components and utilities
- **packages/old-frontend**: Original SvelteKit web application (being phased out)

## Development

See individual package READMEs for development instructions.

Big changes are happening! 🚀
