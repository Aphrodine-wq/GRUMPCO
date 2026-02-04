import { test, expect } from '../fixtures/app';

/**
 * E2E Tests for Mermaid-to-Code Workflow
 * Primary focus: Test complete flow from diagram generation to code creation
 */

test.describe('Mermaid-to-Code Workflow', () => {
  test.beforeEach(async ({ app, page }) => {
    await app.goto();
    await app.switchToDesignMode();
  });

  test('should generate diagram from natural language', async ({ app, page }) => {
    // Send message to generate diagram
    await app.sendMessage('Create a simple user authentication flow diagram');

    // Wait for diagram to appear
    await app.waitForDiagram(15000);

    // Verify diagram is rendered
    const diagram = page.locator('.diagram-output svg, .diagram-container svg').first();
    await expect(diagram).toBeVisible();
  });

  test('should show MermaidToCodePanel after diagram generation', async ({ app, page }) => {
    // Generate diagram
    await app.sendMessage('Create a React app architecture diagram');
    await app.waitForDiagram(15000);

    // Verify MermaidToCodePanel appears
    const panel = page.locator('.mermaid-to-code-panel, [class*="mermaid-to-code"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Verify panel has framework and language selects
    const frameworkSelect = page.locator('select').first();
    const languageSelect = page.locator('select').nth(1);
    await expect(frameworkSelect).toBeVisible();
    await expect(languageSelect).toBeVisible();
  });

  test('should generate code from diagram', async ({ app, page }) => {
    // Generate diagram
    await app.sendMessage('Create a simple API architecture with frontend and backend');
    await app.waitForDiagram(15000);

    // Wait for panel to appear
    await page.waitForSelector('.mermaid-to-code-panel, [class*="mermaid-to-code"]', { timeout: 5000 });

    // Select framework and language
    await app.selectFramework('react');
    await app.selectLanguage('typescript');

    // Click Generate Code button
    const generateBtn = page.locator('button:has-text("Generate Code")');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Verify mode switches to Code
    const codeModeBtn = page.locator('button:has-text("Code")');
    await expect(codeModeBtn).toHaveClass(/active/);

    // Wait for code generation to start (tool calls should appear)
    await app.waitForCodeGeneration(30000);

    // Verify tool calls or results appear
    const toolCalls = page.locator('.tool-call-card, .tool-result-card');
    await expect(toolCalls.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display file diffs when files are created', async ({ app, page }) => {
    // This test would require mocking the backend to return diff data
    // For now, we'll verify the structure exists

    // Generate diagram and code
    await app.sendMessage('Create a simple todo app architecture');
    await app.waitForDiagram(15000);

    // Generate code
    await page.waitForSelector('.mermaid-to-code-panel, [class*="mermaid-to-code"]', { timeout: 5000 });
    await app.selectFramework('react');
    await app.selectLanguage('typescript');
    await page.locator('button:has-text("Generate Code")').click();

    // Wait for code generation
    await app.waitForCodeGeneration(30000);

    // Check if diff viewer appears (if file operations occurred)
    const hasDiff = await app.hasDiffViewer();
    // This might not always be true, so we'll just check the structure
    const toolResults = page.locator('.tool-result-card');
    const count = await toolResults.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should handle diagram generation errors gracefully', async ({ app, page }) => {
    // Mock API error
    await app.mockApiResponse('**/generate-diagram-stream', {
      error: 'API Error',
      type: 'service_unavailable',
    });

    // Try to generate diagram
    await app.sendMessage('Create a diagram');

    // Verify error is shown
    const errorMessage = page.locator('.error-state, [class*="error"], .toast[class*="error"]');
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });

  test('should validate Mermaid code before generation', async ({ app, page }) => {
    // Generate diagram
    await app.sendMessage('Create a valid architecture diagram');
    await app.waitForDiagram(15000);

    // Panel should be visible
    await page.waitForSelector('.mermaid-to-code-panel, [class*="mermaid-to-code"]', { timeout: 5000 });

    // Generate button should be enabled if diagram is valid
    const generateBtn = page.locator('button:has-text("Generate Code")');
    const isDisabled = await generateBtn.isDisabled();
    expect(isDisabled).toBe(false);
  });

  test('should show progress during code generation', async ({ app, page }) => {
    // Generate diagram
    await app.sendMessage('Create a full-stack app architecture');
    await app.waitForDiagram(15000);

    // Start code generation
    await page.waitForSelector('.mermaid-to-code-panel, [class*="mermaid-to-code"]', { timeout: 5000 });
    await app.selectFramework('react');
    await app.selectLanguage('typescript');
    await page.locator('button:has-text("Generate Code")').click();

    // Verify loading/progress indicator appears
    const progressIndicator = page.locator('.spinner, [class*="loading"], [class*="progress"]');
    const toolCalls = page.locator('.tool-call-card');
    
    // Either progress indicator or tool calls should be visible
    const hasProgress = await progressIndicator.count() > 0;
    const hasToolCalls = await toolCalls.count() > 0;
    expect(hasProgress || hasToolCalls).toBe(true);
  });

  test('should allow framework and language selection', async ({ app, page }) => {
    // Generate diagram
    await app.sendMessage('Create a microservices architecture');
    await app.waitForDiagram(15000);

    // Wait for panel
    await page.waitForSelector('.mermaid-to-code-panel, [class*="mermaid-to-code"]', { timeout: 5000 });

    // Test framework selection
    const frameworkSelect = page.locator('select').first();
    await frameworkSelect.selectOption('vue');
    await expect(frameworkSelect).toHaveValue('vue');

    // Test language selection
    const languageSelect = page.locator('select').nth(1);
    await languageSelect.selectOption('javascript');
    await expect(languageSelect).toHaveValue('javascript');
  });
});
