import os

filepath = 'backend/tests/services/anticipatoryService.test.ts'

with open(filepath, 'r') as f:
    content = f.read()

# Add mockGetCompletion to vi.hoisted
new_hoisted = content.replace(
    '  mockExec,\n} = vi.hoisted',
    '  mockExec,\n  mockGetCompletion,\n} = vi.hoisted'
).replace(
    '  mockExec: vi.fn(),\n}));',
    '  mockExec: vi.fn(),\n  mockGetCompletion: vi.fn().mockResolvedValue({ text: "{}", error: null }),\n}));'
)

# Add vi.mock for llmGatewayHelper.js
if "llmGatewayHelper.js" not in new_hoisted:
    new_hoisted = new_hoisted.replace(
        "vi.mock('child_process', () => ({",
        "vi.mock('../../src/services/llmGatewayHelper.js', () => ({ getCompletion: (...args: any[]) => mockGetCompletion(...args) }));\nvi.mock('child_process', () => ({"
    )

with open(filepath, 'w') as f:
    f.write(new_hoisted)
    print("Updated test file")
