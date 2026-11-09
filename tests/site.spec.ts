import { test, expect } from '@playwright/test';

const pages = ['/', '/en/', '/mentions-legales/', '/en/mentions-legales/', '/work/repair-ninja/', '/en/work/repair-ninja/', '/work/ghazeline/', '/en/work/ghazeline/', '/work/cafe-mamakin/', '/en/work/flolove-paris/'];

for (const url of pages) {
  test(`${url} loads cleanly`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[hreflang="fr"]')).toHaveCount(1);
    await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
    expect(await page.locator('link[rel=canonical]').getAttribute('href')).toContain(url);
    // No sideways scroll at any width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('French typography: no plain space before « : ? ! »', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/[A-Za-zÀ-ÿ] [:?!](\s|$)/);
});

test('hero says who, what and how to contact in the first screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('boutique');
  await expect(page.getByRole('link', { name: 'Prendre rendez-vous' }).first()).toBeInViewport();
  await expect(page.locator('.wall__intro').getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/33759583230/);
});

test('skip link reaches contact', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#contact$/);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('shows the static sequence and never loads the motion chunk', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (r) => { if (r.url().endsWith('.js')) scripts.push(r.url()); });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-seq-static] .seq__step')).toHaveCount(6);
    await expect(page.locator('[data-seq-pin]')).toBeHidden();
    expect(scripts.some((s) => s.includes('motion'))).toBe(false);
  });
});

test('mobile menu opens and closes with Escape', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only');
  await page.goto('/');
  await page.locator('.site-header .menu-toggle').click();
  await expect(page.locator('#menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeHidden();
});
