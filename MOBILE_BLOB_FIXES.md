# Mobile Blob Visibility Fixes

## Summary
Fixed the blob (GRumpBlob component) not being visible on mobile devices.

## Changes Made

### 1. GRumpBlob.svelte (`frontend/src/components/GRumpBlob.svelte`)
Added mobile-responsive CSS:
- Added `z-index: 10` to ensure blob appears above other elements
- Added `min-width` and `min-height` to prevent blob from shrinking too small
- Adjusted blob sizes for mobile screens:
  - `lg` size: 80px → 64px on mobile
  - `xl` size: 120px → 96px on mobile
- Reduced glow effect intensity on mobile for better visibility

### 2. ChatInterface.svelte (`frontend/src/components/ChatInterface.svelte`)
Added mobile-specific styles for the empty state:
- Adjusted padding: 64px → 48px on mobile
- Increased gap between blob and title: 16px → 20px
- Added `min-height: 200px` to ensure adequate space
- Reduced title font size: 24px → 20px on mobile
- Reduced body text size: 15px → 14px on mobile
- Made text width 100% with padding for better mobile display

## Testing Recommendations
1. Test on mobile devices (or browser dev tools mobile view)
2. Check that the blob is visible in the empty state when chat is first opened
3. Verify blob animations work smoothly on mobile
4. Confirm the blob doesn't overflow or cause layout issues

## Files Modified
- `/home/workspace/grump-site/frontend/src/components/GRumpBlob.svelte`
- `/home/workspace/grump-site/frontend/src/components/ChatInterface.svelte`
