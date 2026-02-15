## 2026-02-12 - Accessible Combobox Interaction
**Learning:** When using a listbox controlled by a combobox input where focus remains on the input, simply highlighting items visually is insufficient for screen readers. The `aria-activedescendant` attribute on the input is crucial to inform users which option is currently "focused" without moving actual DOM focus.
**Action:** Always pair `role="combobox"` with `aria-activedescendant` pointing to the selected `role="option"` ID when implementing custom autocomplete/command palettes.

## 2026-02-13 - Semantic Grouping in Command Palettes
**Learning:** Flat list structures with interspersed headers are visually effective but confusing for screen reader users as they lose the relationship between headers and items. Using nested `role="group"` containers with `aria-label` provides clear semantic boundaries and context.
**Action:** Refactor flat command lists to nested structures using `role="group"` where possible, or use `aria-labelledby` if virtual scrolling prevents nesting.
