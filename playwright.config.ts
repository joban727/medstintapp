import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for MedStint browser tests.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './src/test/browser',

    /* Run tests in serial mode for this ecosystem test */
    fullyParallel: false,

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    /* Limit workers for consistent test order */
    workers: 1,

    /* Reporter to use */
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list']
    ],

    /* Shared settings for all the projects below */
    use: {
        /* Base URL to use in actions like `await page.goto('/')` */
        baseURL: 'http://localhost:3000',

        /* Collect trace when retrying the failed test */
        trace: 'on-first-retry',

        /* Capture screenshots on failure */
        screenshot: 'on',

        /* Capture video on failure */
        video: 'on-first-retry',
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Output folder for test artifacts */
    outputDir: 'test-results/',

    /* Run your local dev server before starting the tests */
    // Uncomment if you want Playwright to start the dev server
    // webServer: {
    //   command: 'npm run dev',
    //   url: 'http://localhost:3000',
    //   reuseExistingServer: !process.env.CI,
    // },
});
