/**
 * School Ecosystem Browser Test
 * 
 * Tests the complete school ecosystem through the browser.
 * 
 * Run with: npx playwright test --headed
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('School Ecosystem Browser Test', () => {
    test.describe.configure({ mode: 'serial' });

    test('Phase 1: Verify homepage loads', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'test-results/01-homepage.png', fullPage: true });
        await expect(page).toHaveTitle(/MedStint/i);

        console.log('✅ Homepage loaded successfully');
    });

    test('Phase 1: Verify sign-up page loads', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth/sign-up`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'test-results/02-signup-page.png', fullPage: true });
        console.log('✅ Sign-up page accessible');
    });

    test('Phase 1: Verify sign-in page loads', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth/sign-in`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'test-results/03-signin-page.png', fullPage: true });
        console.log('✅ Sign-in page accessible');
    });

    test('Phase 1: Verify onboarding user-type page', async ({ page }) => {
        await page.goto(`${BASE_URL}/onboarding/user-type`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'test-results/04-onboarding-usertype.png', fullPage: true });
        console.log('✅ Onboarding user-type page captured');
    });

    test('Phase 1: Verify onboarding school page', async ({ page }) => {
        await page.goto(`${BASE_URL}/onboarding/school`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'test-results/05-onboarding-school.png', fullPage: true });
        console.log('✅ Onboarding school page captured');
    });

    test('Phase 2: Verify School Admin dashboard page', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard/school-admin`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'test-results/06-school-admin-dashboard.png', fullPage: true });
        console.log('✅ School Admin dashboard page captured');
    });

    test('Phase 2: Verify Student dashboard page', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard/student`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'test-results/07-student-dashboard.png', fullPage: true });
        console.log('✅ Student dashboard page captured');
    });

    test('Phase 2: Verify Clinical Preceptor dashboard page', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard/clinical-preceptor`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'test-results/08-preceptor-dashboard.png', fullPage: true });
        console.log('✅ Clinical Preceptor dashboard page captured');
    });

    test('Phase 2: Verify Clinical Supervisor dashboard page', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard/clinical-supervisor`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'test-results/09-supervisor-dashboard.png', fullPage: true });
        console.log('✅ Clinical Supervisor dashboard page captured');
    });

    test('Final: Capture all key pages', async ({ page }) => {
        const pages = [
            { name: 'homepage', url: '/' },
            { name: 'auth-signup', url: '/auth/sign-up' },
            { name: 'auth-signin', url: '/auth/sign-in' },
            { name: 'onboarding-usertype', url: '/onboarding/user-type' },
            { name: 'onboarding-school', url: '/onboarding/school' },
            { name: 'dashboard-admin', url: '/dashboard/school-admin' },
            { name: 'dashboard-student', url: '/dashboard/student' },
            { name: 'dashboard-preceptor', url: '/dashboard/clinical-preceptor' },
            { name: 'dashboard-supervisor', url: '/dashboard/clinical-supervisor' },
        ];

        for (const p of pages) {
            await page.goto(`${BASE_URL}${p.url}`);
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(500);
            await page.screenshot({
                path: `test-results/final-${p.name}.png`,
                fullPage: true
            });
        }

        console.log('✅ All page screenshots captured');
        console.log('📁 Screenshots saved to: test-results/');
        console.log('🎉 School Ecosystem Browser Test Complete!');
    });
});
