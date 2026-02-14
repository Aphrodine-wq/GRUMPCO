## 2026-02-12 - Accessible Combobox Interaction
**Learning:** When using a listbox controlled by a combobox input where focus remains on the input, simply highlighting items visually is insufficient for screen readers. The `aria-activedescendant` attribute on the input is crucial to inform users which option is currently "focused" without moving actual DOM focus.
**Action:** Always pair `role="combobox"` with `aria-activedescendant` pointing to the selected `role="option"` ID when implementing custom autocomplete/command palettes.
