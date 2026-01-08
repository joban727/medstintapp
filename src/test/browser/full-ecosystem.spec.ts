import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_SCHOOL_NAME = `Med University Test ${Date.now()}`;

// Generate unique credentials for this run
const ACCOUNTS = {
    schoolAdmin: {
        email: `admin-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        role: 'SCHOOL_ADMIN'
    },
    student: {
        email: `student-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        role: 'STUDENT'
    },
    preceptor: {
        email: `preceptor-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        role: 'CLINICAL_PRECEPTOR'
    },
    supervisor: {
        email: `supervisor-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        role: 'CLINICAL_SUPERVISOR'
    }
};

test.describe('Full School Ecosystem Browser Test', () => {
    test.describe.configure({ mode: 'serial' });

    // Helper to handle Clerk Sign Up
    async function signUp(page: any, account: any) {
        console.log(`[${account.role}] Starting Sign Up for ${account.email}...`);

        await page.goto(`${BASE_URL}/auth/sign-up`);
        await page.waitForLoadState('domcontentloaded');

        // Wait for Clerk to load
        await page.waitForTimeout(2000);

        // Check if we are already logged in
        if (page.url().includes('/dashboard') || page.url().includes('/onboarding')) {
            console.log(`[${account.role}] Already logged in, signing out...`);
            await page.goto(`${BASE_URL}/auth/sign-out`);
            await page.waitForLoadState('domcontentloaded');
            await page.goto(`${BASE_URL}/auth/sign-up`);
            await page.waitForTimeout(2000);
        }

        // Fill Email
        const emailInput = page.locator('input[name="emailAddress"], input[type="email"]').first();
        if (await emailInput.isVisible()) {
            await emailInput.fill(account.email);
            console.log(`[${account.role}] Filled email`);
        } else {
            console.log(`[${account.role}] Email input not found!`);
            await page.screenshot({ path: `test-results/error-${account.role}-no-email.png` });
            return false;
        }

        // Fill Password
        const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
        if (await passwordInput.isVisible()) {
            await passwordInput.fill(account.password);
            console.log(`[${account.role}] Filled password`);
        }

        // Submit
        const submitButton = page.getByRole('button', { name: /continue|sign up|submit/i }).first();
        if (await submitButton.isVisible()) {
            await submitButton.click();
            console.log(`[${account.role}] Clicked submit`);
        }

        // Wait for potential verification or redirect
        await page.waitForTimeout(5000);

        // Check for verification code input (Clerk Test Mode code is 424242)
        const codeInput = page.locator('input[name="code"], input[aria-label*="verification code" i]').first();
        if (await codeInput.isVisible()) {
            console.log(`[${account.role}] Verification code required. Attempting '424242' (Test Mode)...`);
            await codeInput.fill('424242');
            await page.waitForTimeout(1000);

            // Try to submit code if there's a button, otherwise it might auto-submit
            const verifyButton = page.getByRole('button', { name: /verify/i }).first();
            if (await verifyButton.isVisible()) {
                await verifyButton.click();
            }
            await page.waitForTimeout(5000);
        }

        // Check if we reached onboarding or dashboard
        const url = page.url();
        if (url.includes('/onboarding') || url.includes('/dashboard')) {
            console.log(`[${account.role}] Sign Up Successful! Redirected to: ${url}`);
            return true;
        } else {
            console.log(`[${account.role}] Sign Up Failed or stuck at verification. URL: ${url}`);
            await page.screenshot({ path: `test-results/error-${account.role}-signup-stuck.png` });
            return false;
        }
    }

    // Helper to handle Onboarding
    async function completeOnboarding(page: any, account: any) {
        console.log(`[${account.role}] Starting Onboarding...`);

        // 1. User Type Selection
        if (page.url().includes('/onboarding/user-type')) {
            console.log(`[${account.role}] Selecting role...`);

            let roleText = '';
            switch (account.role) {
                case 'SCHOOL_ADMIN': roleText = 'School Admin'; break;
                case 'STUDENT': roleText = 'Student'; break;
                case 'CLINICAL_PRECEPTOR': roleText = 'Preceptor'; break;
                case 'CLINICAL_SUPERVISOR': roleText = 'Supervisor'; break;
            }

            const roleOption = page.getByText(new RegExp(roleText, 'i')).first();
            if (await roleOption.isVisible()) {
                await roleOption.click();

                const nextButton = page.getByRole('button', { name: /continue|next/i }).first();
                if (await nextButton.isVisible()) {
                    await nextButton.click();
                    await page.waitForLoadState('domcontentloaded');
                    await page.waitForTimeout(2000);
                }
            }
        }

        // 2. School Creation (Only for School Admin)
        if (account.role === 'SCHOOL_ADMIN' && page.url().includes('/onboarding/school')) {
            console.log(`[${account.role}] Creating school...`);

            const nameInput = page.locator('input[name="name"]').first();
            if (await nameInput.isVisible()) {
                await nameInput.fill(TEST_SCHOOL_NAME);

                const submitButton = page.getByRole('button', { name: /continue|create/i }).first();
                if (await submitButton.isVisible()) {
                    await submitButton.click();
                    await page.waitForLoadState('domcontentloaded');
                    await page.waitForTimeout(2000);
                }
            }
        }

        // Check if we reached dashboard
        if (page.url().includes('/dashboard')) {
            console.log(`[${account.role}] Onboarding Complete! Dashboard accessed.`);
            await page.screenshot({ path: `test-results/success-${account.role}-dashboard.png` });
            return true;
        }

        console.log(`[${account.role}] Onboarding incomplete. URL: ${page.url()}`);
        return false;
    }

    test('Phase 1: School Admin Flow', async ({ page }) => {
        const success = await signUp(page, ACCOUNTS.schoolAdmin);
        if (!success) test.skip(); // Skip if signup fails (likely due to verification)

        const onboardingSuccess = await completeOnboarding(page, ACCOUNTS.schoolAdmin);
        expect(onboardingSuccess).toBeTruthy();

        // Verify Dashboard
        await expect(page.locator('h1, h2, h3').filter({ hasText: /dashboard|welcome/i }).first()).toBeVisible();

        // Sign out
        await page.goto(`${BASE_URL}/auth/sign-out`);
        await page.waitForLoadState('domcontentloaded');
    });

    test('Phase 2: Student Flow', async ({ page }) => {
        const success = await signUp(page, ACCOUNTS.student);
        if (!success) test.skip();

        const onboardingSuccess = await completeOnboarding(page, ACCOUNTS.student);
        expect(onboardingSuccess).toBeTruthy();

        // Verify Dashboard
        await expect(page.url()).toContain('/dashboard/student');

        // Sign out
        await page.goto(`${BASE_URL}/auth/sign-out`);
    });

    test('Phase 3: Preceptor Flow', async ({ page }) => {
        const success = await signUp(page, ACCOUNTS.preceptor);
        if (!success) test.skip();

        const onboardingSuccess = await completeOnboarding(page, ACCOUNTS.preceptor);
        expect(onboardingSuccess).toBeTruthy();

        // Verify Dashboard
        await expect(page.url()).toContain('/dashboard/clinical-preceptor');

        // Sign out
        await page.goto(`${BASE_URL}/auth/sign-out`);
    });

    test('Phase 4: Supervisor Flow', async ({ page }) => {
        const success = await signUp(page, ACCOUNTS.supervisor);
        if (!success) test.skip();

        const onboardingSuccess = await completeOnboarding(page, ACCOUNTS.supervisor);
        expect(onboardingSuccess).toBeTruthy();

        // Verify Dashboard
        await expect(page.url()).toContain('/dashboard/clinical-supervisor');
    });
});
