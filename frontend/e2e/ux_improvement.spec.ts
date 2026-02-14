import { test, expect } from '@playwright/test';

test('verify suggestion chips in empty state', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5173');

  // Check for onboarding skip button and click it if present
  try {
    const skipButton = page.locator('button.skip-button');
    if (await skipButton.isVisible({ timeout: 5000 })) {
      await skipButton.click();
    }
  } catch (e) {
    // Ignore error if skip button is not found or fails
  }

  // Wait for the main empty state title
  await expect(page.getByText('What are we building?')).toBeVisible({ timeout: 10000 });

  // Verify suggestion chips (checking the visible labels)
  const expectedChips = [
    "Design microservices",
    "Build full-stack app",
    "Create REST API",
    "Design system"
  ];

  for (const chipLabel of expectedChips) {
    await expect(page.getByRole('button', { name: chipLabel })).toBeVisible();
  }
});
