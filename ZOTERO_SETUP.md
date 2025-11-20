# Zotero Translation Server Setup

This document explains how to set up and use Zotero translation-server for metadata extraction in CardCutter.

## What is Zotero Translation Server?

Zotero translation-server is a Node.js-based HTTP server that runs Zotero's translators - specialized scripts that extract metadata from thousands of websites including:

- **Academic publishers**: JSTOR, ScienceDirect, PubMed, arXiv, Google Scholar
- **News sites**: New York Times, Washington Post, The Atlantic, Reuters
- **Think tanks**: RAND Corporation, Brookings Institution, Council on Foreign Relations
- **Government sites**: Congressional Research Service, GAO, CDC
- **General sites**: Wikipedia, YouTube, Twitter/X, and many more

Translation-server provides **much more accurate metadata extraction** than simple meta tag scraping, with site-specific logic for proper author name parsing, publication dates, and source information.

## Installation Options

### Option 1: Docker (Recommended)

The easiest way to run translation-server is using Docker:

```bash
docker run -d -p 1969:1969 --name translation-server zotero/translation-server
```

This will:
- Download the official translation-server Docker image
- Run it in the background (`-d`)
- Map port 1969 to your local machine
- Name the container `translation-server`

To verify it's running:

```bash
curl http://localhost:1969
```

You should see a response indicating the server is running.

#### Managing the Docker Container

**Start the container** (after stopping):
```bash
docker start translation-server
```

**Stop the container**:
```bash
docker stop translation-server
```

**View logs**:
```bash
docker logs translation-server
```

**Update to latest version**:
```bash
docker stop translation-server
docker rm translation-server
docker pull zotero/translation-server
docker run -d -p 1969:1969 --name translation-server zotero/translation-server
```

### Option 2: Manual Installation

If you prefer not to use Docker:

1. **Install Node.js** (version 14 or higher)

2. **Clone the repository**:
   ```bash
   git clone https://github.com/zotero/translation-server.git
   cd translation-server
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Update translators**:
   ```bash
   npm run update
   ```

5. **Start the server**:
   ```bash
   npm start
   ```

The server will start on port 1969 by default.

## Configuration in CardCutter

The WebExtension automatically checks for translation-server on startup. If it's not running, you'll see errors in the browser console when trying to extract metadata.

### Default Configuration

- **Endpoint**: `http://localhost:1969`
- **Timeout**: 10000ms (10 seconds)

### Changing the Endpoint

If you're running translation-server on a different port or host, you can configure it:

1. The configuration is stored in browser storage (key: `cardcutter_zotero_config`)
2. Currently, you need to manually edit it via browser console:

```javascript
// In the extension popup, open browser console and run:
browser.storage.local.set({
  cardcutter_zotero_config: {
    enabled: true,
    endpoint: 'http://localhost:1969', // Change this if needed
    timeout: 10000
  }
});
```

> **Note**: We plan to add a UI for Zotero configuration in a future update.

## How It Works

### Extraction Flow

1. **User enters URL** in the extension popup
2. **Content script** extracts the full HTML of the current page
3. **Popup** sends the HTML + URL to translation-server
4. **Translation-server** runs site-specific translators to extract metadata
5. **Metadata is returned** in Zotero's JSON format
6. **Mapper** converts Zotero data to CardCutter's citation format
7. **AI enhancement** (optional) extracts author qualifications from the HTML

### What Gets Extracted

From Zotero translators:
- **Authors**: First name, last name, properly parsed for multiple authors
- **Title**: Article/page title
- **Publication**: Journal/magazine/blog name
- **Publisher**: Publisher or website name
- **Date**: Publication date (formatted as "Month YYYY")
- **URL**: Canonical URL
- **DOI**: Digital Object Identifier (for academic papers)
- **Pages**: Page numbers (for journal articles)

Enhanced with AI (if configured):
- **Author qualifications**: Credentials, job title, affiliation

## Troubleshooting

### Translation-server not running

**Error message**: "Zotero extraction failed. Make sure translation-server is running."

**Solutions**:
1. Check if Docker container is running: `docker ps`
2. Start the container: `docker start translation-server`
3. Verify it's accessible: `curl http://localhost:1969`

### Connection refused

**Error message**: "Failed to fetch" or "Connection refused"

**Solutions**:
1. Make sure translation-server is running on port 1969
2. Check firewall settings
3. Try restarting the Docker container

### No metadata extracted

**Error message**: "Zotero extraction failed"

**Possible causes**:
1. The website doesn't have a Zotero translator
2. The page structure has changed and the translator needs updating
3. The page is behind a paywall or login

**Solutions**:
1. Check if a translator exists for the site: https://www.zotero.org/support/translators
2. Update your translation-server to get the latest translators
3. Try extracting from a different URL or public version of the article

### Timeouts

**Error message**: "Request timed out"

**Solutions**:
1. Increase the timeout in configuration (for complex pages)
2. Check your internet connection (translation-server may need to fetch external resources)
3. Try a simpler page from the same site

## Performance Notes

- **First request**: May take 1-3 seconds as translators are loaded
- **Subsequent requests**: Usually <500ms
- **Complex sites**: Academic publishers may take longer (2-5 seconds)
- **Caching**: Translation-server caches translator code, not page results

## Privacy

Translation-server runs **locally on your machine**. Your browsing data is never sent to external servers (except when translation-server itself needs to fetch publicly accessible metadata like DOIs).

## Advanced Usage

### API Endpoints

Translation-server exposes several endpoints:

- **POST /web**: Translate a URL or HTML document
- **POST /search**: Search for items by identifier (DOI, ISBN, PMID, arXiv ID)
- **GET /**: Server status

### Example: Extract metadata from a DOI

```bash
curl -X POST -H "Content-Type: text/plain" -d "10.1234/example.doi" http://localhost:1969/search
```

### Example: Extract metadata from HTML

```bash
curl -X POST -H "Content-Type: text/plain" --data-binary @article.html http://localhost:1969/web
```

## Resources

- **Translation-server GitHub**: https://github.com/zotero/translation-server
- **Zotero translators list**: https://github.com/zotero/translators
- **Zotero documentation**: https://www.zotero.org/support/dev/translators
- **Docker Hub**: https://hub.docker.com/r/zotero/translation-server

## Future Improvements

Planned enhancements for CardCutter's Zotero integration:

1. **UI for configuration**: Settings panel to configure translation-server endpoint
2. **Fallback to public instance**: Option to use Zotero's hosted translation service
3. **Offline mode**: Bundle common translators for offline use
4. **Translator selection**: Choose specific translator when multiple match
5. **Metadata preview**: Show raw Zotero item data before conversion
