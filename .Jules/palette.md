## 2026-02-13 - Command Palette Role Confusion
**Learning:** Custom command palettes often misuse `role="menu"` for the wrapper, confusing assistive tech when the interaction model is actually a `combobox` + `listbox`.
**Action:** When implementing or fixing command palettes, ensure the input controls a `listbox` via `aria-activedescendant`, and the wrapper role is `none` or `dialog` depending on overlay usage, avoiding `menu` unless it's a menu bar.
