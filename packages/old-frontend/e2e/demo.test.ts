import { expect, test } from '@playwright/test';

test('citation uses only the publication year beside the author', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
	await expect(page.getByText('Page Number', { exact: true })).toHaveCount(0);
	await page.getByPlaceholder('Michael').fill('Ada');
	await page.getByPlaceholder('Mazarr').fill('Lovelace');
	await page.getByPlaceholder('2022', { exact: true }).fill('November 9, 2022');
	await expect(page.getByPlaceholder('2022', { exact: true })).toHaveValue('2022');
	const preview = page.locator('[data-intro=preview]');
	await expect(preview.locator('strong').first()).toHaveText('Lovelace 2022');
	await expect(preview).not.toContainText('November');
	await expect(preview).not.toContainText('p. ');
	await page.getByRole('radio', { name: 'One author + et al.' }).check();
	await expect(preview.locator('strong').first()).toHaveText('Lovelace 2022');
	await page.getByRole('radio', { name: 'Organization', exact: true }).check();
	await page.getByPlaceholder('RAND Corporation').first().fill('Research Institute');
	await expect(preview.locator('strong').first()).toHaveText('Research Institute 2022');
});
