import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const icon = await readFile(resolve('public/icon/96.png'));
const output = resolve('../../store-assets/chrome-promo.png');
await mkdir(resolve('../../store-assets'), { recursive: true });

const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }) });
try {
	const page = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
	await page.setContent(`<!doctype html><html><head><style>
		* { box-sizing: border-box; }
		body { margin: 0; width: 440px; height: 280px; overflow: hidden; color: #111827; background: linear-gradient(135deg, #eff6ff, #e0e7ff); font-family: Arial, sans-serif; }
		main { height: 100%; padding: 30px 32px; }
		.icon { width: 64px; height: 64px; border-radius: 13px; }
		h1 { margin: 20px 0 8px; font: 700 34px/1.1 Arial, sans-serif; }
		p { margin: 0; width: 335px; font: 16px/1.4 Arial, sans-serif; color: #4b5563; }
	</style></head><body><main>
		<img class="icon" src="data:image/png;base64,${icon.toString('base64')}" alt="">
		<h1>Card Cutter</h1><p>Format debate evidence with citations and highlighting.</p>
	</main></body></html>`);
	await page.screenshot({ path: output });
} finally {
	await browser.close();
}
console.log(output);
