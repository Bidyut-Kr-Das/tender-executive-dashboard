# EPC Subcategory Resolution Rules

The EPC subcategory selected by the user in the upload dropdown is not trusted. For every tender uploaded under the **EPC** category, the subcategory is derived per tender from the tender brief and the organization name. This is implemented by `resolveEpcSubCategory` in `lib/tender-categories.ts`.

- Validation runs **only** when the dropdown category is `EPC`.
- When the dropdown category is `Manufacturing`, no validation runs and the user's selection is kept as-is.
- The category value itself always stays `EPC` in this path.
- Matching is case-insensitive substring matching on the tender brief and organization name.
- If any rule matches, its subcategory **overrides** the user's dropdown selection.
- If no rule matches, the user's dropdown subcategory is kept as the fallback.

## Rule precedence

Rules are evaluated in order. The first match wins.

### Railways (ground rules, always win)

- If the organization name contains `railway`, the subcategory is **Railways**.
- If the tender brief contains `pijf`, the subcategory is **Railways**.

### Power Transmission

- If the tender brief contains `opgw` **and** does **not** contain `supply`, the subcategory is **Power Transmission**.
- If the tender brief contains `transmission`, the subcategory is **Power Transmission**.

### Power Distribution

- If the tender brief contains `distribution`, the subcategory is **Power Distribution**.
- If the tender brief contains both `under` **and** `ground`, the subcategory is **Power Distribution**.

### No match

- If none of the rules above match, the subcategory stays as the user's dropdown selection.

## Notes

- `organization` is the mapped value of the client/organization column (`organization` field in `lib/tender-columns.ts`).
- The `under` + `ground` rule matches substrings anywhere in the brief, so `underground` also matches.
- The `opgw` rule is skipped entirely when `supply` is present, even if `opgw` is mentioned.
