# NSDA Debate Card Cutter

An automatic debate card cutting tool for NSDA debate that helps you format evidence citations and apply customizable highlighting levels.

## Features

- **Automatic Citation Extraction**: Paste a URL and the app automatically extracts:
  - Author name
  - Article title
  - Publisher/source
  - Publication date
  - And more metadata from the webpage

- **Customizable Highlight Levels**: Configure unlimited highlight levels with:
  - Bold
  - Underline
  - Font size
  - Text color
  - Background color
  - Settings saved to browser localStorage

- **Rich Text Output**: Copy formatted cards that preserve styling when pasted into:
  - Microsoft Word
  - Google Docs
  - Other WYSIWYG editors

- **NSDA Citation Format**: Generates properly formatted citations like:
  ```
  Michael J. Mazarr (Senior Political Scientist at the RAND Corporation); March 2022
  [Understanding Competition: Great Power Rivalry in a Changing International Order — Concepts
  and Theories; RAND Corporation; https://www.rand.org/pubs/perspectives/PEA1404-1.html;
  DOA 11/9/22 //VCHS CL]
  ```

## Usage

### 1. Enter Source Information
- Paste the article URL in the "Article URL" field
- The app will automatically extract metadata
- Review and adjust citation fields as needed
- Add your school code (e.g., "VCHS CL")

### 2. Add Evidence Text
- Paste your evidence text in the "Evidence Text" area
- Select text you want to highlight
- Click a highlight level button to apply formatting
- Repeat for different sections

### 3. Configure Highlight Levels
- Click "Configure Highlight Levels" button
- Add, remove, or modify highlight levels
- Adjust formatting (bold, underline, colors, etc.)
- Changes are saved automatically to your browser

### 4. Copy Your Card
- Review the formatted card in the preview
- Click "Copy to Clipboard"
- Paste into Word, Google Docs, or any WYSIWYG editor

## Development

### Prerequisites
- Node.js 18+ and npm

### Setup
```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

### Build for Production
```bash
npm run build
```

The static files will be output to the `build/` directory.

## Deployment to GitHub Pages

### Option 1: Using GitHub Actions (Recommended)

1. The GitHub Actions workflow is already configured in `.github/workflows/deploy.yml`

2. In your GitHub repository settings:
   - Go to Settings > Pages
   - Set Source to "GitHub Actions"

3. Push to the main branch and the site will automatically deploy

### Option 2: Manual Deployment

```bash
npm run build
# Upload the contents of the build/ directory to your web host
```

## Technology Stack

- **SvelteKit 2** with Svelte 5 (runes)
- **TypeScript**
- **Tailwind CSS 4**
- **Vite 7**
- Adapter-static for static site generation

## Browser Requirements

- Modern browser with support for:
  - Clipboard API
  - LocalStorage
  - ES2020+

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
