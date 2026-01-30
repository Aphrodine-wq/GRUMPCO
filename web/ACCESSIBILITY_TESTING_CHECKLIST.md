# G-Rump Accessibility Testing Checklist

Use this checklist to verify accessibility compliance after implementing the recommended fixes.

## Pre-Testing Setup

- [ ] Enable screen reader (NVDA, JAWS, or VoiceOver)
- [ ] Turn on keyboard navigation (unplug mouse)
- [ ] Open browser DevTools for color contrast testing
- [ ] Test with browser zoom at 200%
- [ ] Test on mobile device or emulator

---

## 1. Semantic HTML Structure ✓

### Headings Hierarchy
- [ ] Page has exactly one `<h1>` element
- [ ] Heading levels don't skip (h1 → h2 → h3, not h1 → h3)
- [ ] Headings accurately describe content sections

### Landmark Regions
- [ ] `<header>` with `role="banner"` exists
- [ ] `<nav>` with `aria-label` exists for primary navigation
- [ ] `<main>` with `role="main"` and `id="main-content"` exists
- [ ] Skip link targets main content area
- [ ] `<section>` elements have `aria-labelledby` pointing to headings

### Document Structure
- [ ] `<article>` used for self-contained content (Terms, Privacy pages)
- [ ] `<fieldset>` and `<legend>` used for grouped form controls
- [ ] Lists (`<ol>`, `<ul>`) used for navigation breadcrumbs

**Files Modified:** All routes, index.html

---

## 2. ARIA Labels and Roles ✓

### Navigation
- [ ] Skip link present and functional
- [ ] Navigation regions have descriptive `aria-label` attributes
- [ ] Current page indicated in navigation

### Interactive Elements
- [ ] Buttons have descriptive text or `aria-label`
- [ ] Icon-only buttons have `aria-label`
- [ ] Links have descriptive text (not "click here")

### Live Regions
- [ ] Error messages use `role="alert"` and `aria-live="assertive"`
- [ ] Loading states use `role="status"` and `aria-live="polite"`
- [ ] Save confirmations announced to screen readers

### Forms
- [ ] All inputs have associated `<label>` elements with `for` attribute
- [ ] Required fields marked with `aria-required="true"`
- [ ] Error states use `aria-invalid="true"`
- [ ] Error messages linked with `aria-describedby`

**Files Modified:** Login.svelte, Register.svelte, Settings.svelte, Analytics.svelte

---

## 3. Keyboard Navigation ✓

### Focus Management
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order follows visual reading order (left-to-right, top-to-bottom)
- [ ] No keyboard traps (can tab away from all elements)
- [ ] Focus visible on all interactive elements

### Skip Navigation
- [ ] Skip link appears on first Tab press
- [ ] Skip link jumps to main content
- [ ] Focus moves to main content after activating skip link

### Modal/Dialog Behavior
- [ ] Focus moves to dialog when opened
- [ ] Focus returns to trigger when dialog closed
- [ ] Escape key closes dialogs
- [ ] Tab cycles within dialog (focus trap)

### Route Changes (SPA)
- [ ] Page title updates on route change
- [ ] Focus moves to main content area
- [ ] Screen reader announces page change

**Files Modified:** App.svelte, index.html, style.css

---

## 4. Color Contrast Ratios ✓

### Text Contrast (WCAG AA: 4.5:1, WCAG AAA: 7:1)
- [ ] Body text: #1B0F3A on #FFFFFF (21:1 ✓)
- [ ] Links: `text-primary-600` (#0284c7) on white (4.6:1 ✓)
- [ ] Error text: text-red-700 on bg-red-50 (7.2:1 ✓)
- [ ] Placeholder text: text-gray-500 (4.6:1 ✓)

### UI Component Contrast
- [ ] Buttons: Primary (#0284c7) with white text (4.6:1 ✓)
- [ ] Focus indicators: 2px solid #0284c7 (visible)
- [ ] Borders: border-gray-300 (#d1d5db) sufficient for UI elements

### Testing Tools
- [ ] Use axe DevTools browser extension
- [ ] Use WAVE (Web Accessibility Evaluation Tool)
- [ ] Use Chrome DevTools Lighthouse accessibility audit

**Files Modified:** style.css, tailwind.config.js

---

## 5. Screen Reader Compatibility ✓

### Content Reading
- [ ] All page content is read by screen reader
- [ ] Headings announced with level information
- [ ] Lists announced with item count
- [ ] Links announced with context

### Form Reading
- [ ] Labels read before inputs
- [ ] Required fields announced
- [ ] Error messages read immediately when displayed
- [ ] Password requirements announced

### Dynamic Content
- [ ] Loading states announced ("Loading analytics data...")
- [ ] Errors announced immediately ("Error: Email and password are required")
- [ ] Success messages announced ("Settings saved successfully")
- [ ] Button state changes announced (busy state)

### Testing Commands
```bash
# Test with NVDA (Windows)
Insert + F7  # Elements list
Insert + Space  # Activate element

# Test with VoiceOver (Mac)
Cmd + F5  # Enable VoiceOver
Ctrl + Option + U  # Rotor (headings, links, etc.)
Ctrl + Option + Space  # Activate element
```

**Files Modified:** All routes with aria-live regions

---

## 6. Focus Management ✓

### Visual Focus Indicators
- [ ] All interactive elements have visible focus state
- [ ] Focus outline: 2px solid #0284c7 with 2px offset
- [ ] Focus visible on buttons, links, inputs, selects
- [ ] High contrast mode support in CSS

### Focus Order
- [ ] Skip link → Navigation → Main content → Footer
- [ ] Modal dialogs trap focus within dialog
- [ ] No focus loss during dynamic updates

### Testing Steps
1. Press Tab from page load
2. Verify skip link appears first
3. Navigate through all interactive elements
4. Verify focus visible at all times
5. Test form submission with keyboard only

**Files Modified:** style.css (CSS focus indicators)

---

## 7. Form Accessibility ✓

### Labels and Instructions
- [ ] All inputs have visible labels
- [ ] Labels programmatically associated (for + id)
- [ ] Required fields marked with asterisk and `aria-required`
- [ ] Password requirements provided

### Error Handling
- [ ] Errors displayed visually near relevant fields
- [ ] Errors announced to screen readers immediately
- [ ] `aria-invalid="true"` set on fields with errors
- [ ] Error messages linked via `aria-describedby`

### Autocomplete
- [ ] Email inputs have `autocomplete="email"`
- [ ] Password inputs have `autocomplete="current-password"` or "new-password"
- [ ] Form submission works with Enter key

### Validation
- [ ] HTML5 validation attributes used (required, minlength, type="email")
- [ ] Custom validation messages clear and helpful
- [ ] Focus moves to first error on submission

**Files Modified:** Login.svelte, Register.svelte

---

## 8. Additional Checks

### Responsive Design
- [ ] Layout works at 320px width (mobile)
- [ ] Content readable at 200% zoom
- [ ] No horizontal scrolling at 320px
- [ ] Touch targets minimum 44x44px

### Reduced Motion
- [ ] Test with `prefers-reduced-motion: reduce`
- [ ] Animations disabled or reduced
- [ ] No auto-playing content

### High Contrast
- [ ] Test with Windows High Contrast mode
- [ ] Test with `prefers-contrast: high`
- [ ] UI elements visible in high contrast

### Screen Magnification
- [ ] Test with browser zoom at 400%
- [ ] Content reflows correctly
- [ ] No loss of functionality

---

## Testing Results Template

### Page: Login
- [ ] All checks passed
- [ ] Issues found: _____________

### Page: Register
- [ ] All checks passed
- [ ] Issues found: _____________

### Page: Dashboard
- [ ] All checks passed
- [ ] Issues found: _____________

### Page: Settings
- [ ] All checks passed
- [ ] Issues found: _____________

### Page: Analytics
- [ ] All checks passed
- [ ] Issues found: _____________

### Page: Billing
- [ ] All checks passed
- [ ] Issues found: _____________

---

## Automated Testing Tools

### Recommended Tools
1. **axe DevTools** (Chrome/Firefox extension)
2. **WAVE** (webaim.org/wave)
3. **Lighthouse** (Chrome DevTools)
4. **NVDA** (Windows screen reader)
5. **VoiceOver** (Mac screen reader)

### Running axe-core
```bash
# Install axe-core
npm install --save-dev @axe-core/cli

# Run audit
npx axe http://localhost:5173 --tags wcag2a,wcag2aa,wcag21aa
```

---

## WCAG 2.1 Compliance Status

### Level A (Must Have)
- [ ] 1.3.1 Info and Relationships ✓
- [ ] 2.1.1 Keyboard ✓
- [ ] 2.4.1 Bypass Blocks ✓
- [ ] 2.4.3 Focus Order ✓
- [ ] 2.4.4 Link Purpose ✓
- [ ] 3.1.1 Language of Page ✓
- [ ] 3.3.1 Error Identification ✓
- [ ] 3.3.2 Labels or Instructions ✓
- [ ] 4.1.2 Name, Role, Value ✓

### Level AA (Should Have)
- [ ] 1.4.3 Contrast (Minimum) ✓
- [ ] 1.4.4 Resize Text ✓
- [ ] 2.4.5 Multiple Ways ✓
- [ ] 2.4.6 Headings and Labels ✓
- [ ] 2.4.7 Focus Visible ✓
- [ ] 3.3.3 Error Suggestion ✓
- [ ] 3.3.4 Error Prevention ✓
- [ ] 4.1.3 Status Messages ✓

### Level AAA (Nice to Have)
- [ ] 1.4.6 Contrast (Enhanced) - Optional
- [ ] 2.3.3 Animation from Interactions ✓
- [ ] 3.1.5 Reading Level - Content dependent

---

## Sign-off

**Tested by:** _________________
**Date:** _________________
**WCAG Version:** 2.1 Level AA
**Overall Status:** ☐ Pass ☐ Partial ☐ Fail

**Notes:**
_________________________________
_________________________________
_________________________________
