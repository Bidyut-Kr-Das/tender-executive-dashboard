# Design system (v2)

This describes the v2 interface as built. The reference page is `/v2/tenders`; every other page migrated to v2 should look and behave like it. v1 pages under `app/(v1)/` are not covered and do not follow these rules.

The feel to aim for: calm, dense, fast. A working tool for people who scan hundreds of tenders a day. Nothing decorative, nothing that makes a frequent action slower.

## Where things live

| Path | What |
|---|---|
| `app/(v2)/v2.css` | All tokens, animation theme values, overlay motion classes, media-query fallbacks |
| `app/(v2)/layout.tsx` | v2 root layout (fonts, boot script, providers, shell) |
| `components/v2/ui/` | Primitives: `button`, `field`, `overlay`, `sheet` |
| `components/v2/shell/` | Sidebar shell and `nav-items.ts` |
| `components/v2/data-table/` | Generic table, column filters, chips, pagination |
| `components/v2/<page>/` | One folder per page: `columns.tsx`, `cells.tsx`, view, Redux hook |

## Ground rules

1. **UI only.** Database, server actions, API routes and Redux slices are not changed for v2. A page loads and patches data exactly as its v1 version does.
2. **No v1 components.** Nothing from `components/` outside `components/v2` is imported into v2. Non-UI code in `lib/` (slices, formatters, option lists, `cn`) is shared.
3. **Tables stay tables.** Every column a user can see is shown as a column, and every column with a server-side filter gets a filter control.
4. **No business logic in the table.** `DataTable` knows nothing about tenders. What a cell shows, which buttons and dialogs it carries, how a column filters, how columns merge: all of that is in the page's column definitions.
5. **Icons are `lucide-react` only.** No emoji, no hand-drawn SVG.
6. **Sans-serif only.** Geist for text, Geist Mono for identifiers. Never a serif face.

## Colour

Tokens are CSS variables on `:root`, redefined under `.dark`, and exposed to Tailwind through `@theme` (so `bg-surface`, `text-ink-2`, `border-line` and so on). Use the token, never a raw hex value in a component.

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#f5f5f7` | `#111113` | Page background |
| `surface` | `#ffffff` | `#1a1a1d` | Table, cards, inputs |
| `raised` | `#ffffff` | `#242428` | Popovers, dialogs, sheet |
| `sunken` | `#f0f0f3` | `#151517` | Inset areas, inline chips, segmented wells |
| `rail` | `#ebebef` | `#0c0c0e` | Sidebar |
| `ink` | `#1d1d1f` | `#f5f5f7` | Primary text |
| `ink-2` | `#55555a` | `#b4b4ba` | Secondary text, column headers |
| `ink-3` | `#8a8a8f` | `#7c7c84` | Tertiary text, placeholders, idle icons |
| `line` | black 8% | white 9% | Hairlines |
| `line-strong` | black 16% | white 20% | Control outlines |
| `hover` | black 4.5% | white 6% | Hover fill |
| `accent` | `#0068d6` | `#2f8fff` | Primary action, active state, focus ring |
| `accent-ink` | `#0058b8` | `#6ab0ff` | Accent-coloured text |
| `accent-soft` | accent 10% | accent 16% | Selected fills, filter chips |
| `good` / `good-soft` | `#1f7a36` | `#4cd471` | Yes, completed, post-participation |
| `bad` / `bad-soft` | `#c4001a` | `#ff6961` | No, failed, destructive |
| `warn` / `warn-soft` | `#9a4a00` | `#ffb340` | Attention, rate-limited, variable price |

Rules:

- One accent. Blue marks what is interactive-and-selected or the single primary action in a view. It is not used for decoration.
- Status colour is reserved for status. Green, red and amber appear only where the data means yes, no or caution.
- Status always comes with a word. A badge reads "Yes", "Failed", "Post"; colour alone never carries the meaning.
- Surfaces are separated by a one-step change in tone plus a hairline, not by heavy shadows.

### Theme

The theme is a `dark` class on `<html>`, stored in `localStorage.theme`. v1 uses the same key, so the choice follows the user between shells. An inline boot script in `<head>` applies it before first paint. Every component must be checked in both themes.

## Typography

Base size is `0.8125rem` (13px) at line-height 1.45: the product is dense by design. Sizes are in `rem` so the layout scales with the user's text-size setting.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Page title | `1.375rem` | 600 | `-0.022em` |
| Stat value | `1.125rem` (`text-lg`) | 600 | `-0.015em` |
| Dialog and sheet title | `0.9375rem` | 600 | `-0.01em` |
| Body, cells, controls | `0.8125rem` | 400 (500 for emphasis) | 0 |
| Column header, small control | `0.75rem` | 500 | 0 |
| Field label, group label, badge | `0.6875rem` | 500 | `+0.01em` to `+0.02em` |

- Tracking tightens as text grows and opens slightly for the smallest sizes. Do not apply one letter-spacing value across sizes.
- Hierarchy comes from weight and tone (`ink`, `ink-2`, `ink-3`) before size.
- Numbers, counts and dates use `tabular-nums` so columns of figures line up.
- Reference numbers and other identifiers use Geist Mono.
- Labels are sentence case. No all-caps labels.
- Numbers are formatted with `toLocaleString("en-IN")`; dates with the helpers in `lib/format-ist.ts`.

## Shape, depth and materials

- Radius: `rounded-md` (6px) for small controls and menu items, `rounded-lg` (8px) for buttons and inputs, `rounded-xl` (12px) for cards, popovers and the table container, `rounded-2xl` (16px) for dialogs. Badges use `0.3125rem`.
- Outlines are drawn with an inset `box-shadow` (`inset 0 0 0 1px var(--line-strong)`), not `border`, so they do not change an element's size.
- Shadows: `--shadow-pop` for anchored popups, `--shadow-sheet` for dialogs and the sheet. Larger surfaces get the deeper shadow. Flat content gets none.
- Translucency is for chrome that content scrolls under: the sticky table header uses `.glass` (`backdrop-filter: blur(20px) saturate(180%)`). Never stack one translucent layer on another.
- Edge shadows appear only when there is something underneath. The pinned-column shadow shows only once the table is scrolled horizontally.
- A modal task (dialog, sheet) dims the page with `--scrim`. Popovers and menus do not.

## Motion

Motion exists to confirm an action or keep the user oriented. If it does neither, it is removed.

**Tokens**

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Anything entering or responding |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Movement between two on-screen positions |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Reserved for edge panels driven by CSS |
| `--dur-press` | 120ms | Press feedback |
| `--dur-pop` | 150ms | Popovers, menus, selects, tooltips, chips |
| `--dur-dialog` | 220ms | Dialogs and scrim |

**Rules**

- Feedback lands on pointer-down. Every pressable element carries `transition-transform duration-(--dur-press) ease-out motion-safe:not-disabled:active:scale-97`.
- Animate `transform` and `opacity` only. Never `width`, `height`, `padding` or `margin`; never `transition: all`. This is why the sidebar collapses instantly: animating its width re-laid out the table every frame.
- Anchored popups (`.pop`) scale from their trigger with `transform-origin: var(--transform-origin)`, entering from `scale(0.97)` and opacity 0. Dialogs (`.dlg`) are not anchored and stay centre-origin, entering from `scale(0.96)`.
- Nothing enters from `scale(0)`.
- Exit is faster than enter (popups 100ms out, dialogs 140ms out).
- Use CSS transitions (through Base UI's `data-starting-style` / `data-ending-style`), not keyframes, for anything a user can interrupt. Keyframes are only for constant motion: the progress bar, the spinner, skeleton pulse.
- No easing-in on UI. No animation on keyboard-initiated actions or on things done dozens of times a day: sorting, paging, filtering and row updates do not animate. A loading page dims its rows and shows a thin progress bar; rows never stagger in.
- Hover effects sit behind `@media (hover: hover)`, which Tailwind's `hover:` variant applies. Hover background is `not-disabled:hover:bg-hover`.
- Tooltips wait 500ms; once one is open, neighbours open instantly with no transition.

**Gestures**

Springs (`motion`) are used only where a gesture exists. Today that is the sheet (`components/v2/ui/sheet.tsx`):

- Critically damped spring (`bounce: 0`, `duration: 0.4`). A panel that just arrived does not overshoot.
- It enters and leaves along the same edge.
- It is dragged by its header with pointer capture and can be grabbed mid-animation.
- Dismissal is decided by where the gesture is heading, not where it was released: release offset plus projected momentum (`(v / 1000) * d / (1 - d)`, `d = 0.998`) past half the panel width dismisses. A quick flick is enough; a slow short drag snaps back.
- Dragging past the open edge rubber-bands (`dragElastic` 0.06) instead of stopping dead.

## Accessibility

- Every focusable element shows a 2px accent `:focus-visible` ring.
- Icon-only buttons use `IconButton`, which requires a `label` (it becomes both `aria-label` and tooltip text).
- Toggle buttons set `aria-pressed`; the current nav item and page set `aria-current`; sortable headers set `aria-sort`.
- Menus, selects, popovers, dialogs and tooltips are Base UI components, which supply keyboard handling and focus management. Do not hand-roll these.
- `prefers-reduced-motion: reduce`: scale and slide are removed and replaced by opacity changes; the sheet cross-fades and cannot be dragged; looping animations stop.
- `prefers-reduced-transparency: reduce`: `.glass` becomes a solid surface.
- `prefers-contrast: more`: hairlines use `line-strong` and `.glass` becomes solid.

## Layout

- A fixed left sidebar (`14.5rem`, or a `3.5rem` icon rail when collapsed) and one content area. There is no top bar; the theme toggle and account menu sit in the sidebar footer. Collapse state is stored in `localStorage["v2-sidebar"]` and applied before first paint. Ctrl+B toggles it.
- Navigation is grouped by task (Tenders, Operations, Reference, Admin) and each item is named for what it contains. Admin is shown to `admin` and `developer` roles only.
- A page fills the viewport height. Its content is a column with `1rem` padding and `0.75rem` gaps:
  1. Header row: page title with live count on the left, page actions on the right.
  2. Optional summary strip: stat tiles that double as filters, then scope controls.
  3. The table, which takes all remaining height and scrolls internally.
- The page itself does not scroll; the table does.

## Components

### Buttons (`ui/button.tsx`)

- `Button` variants: `primary` (one per view or dialog, for the main action), `secondary` (default), `ghost` (cancel, low-emphasis), `danger` (stop or destroy). Sizes `md` (32px) and `sm` (28px).
- `loading` shows a spinner in place of the icon and disables the button.
- Labels say what happens: "Save website", "Queue analysis", "Parse 3 files". Not "OK" or "Submit".

### Fields (`ui/field.tsx`)

- `Input`, `Textarea`, and `Field` (a small label above its control).
- `Badge` tones: `neutral`, `accent`, `good`, `bad`, `warn`.
- An empty value renders `Dash` (an en dash in `ink-3`), never a blank cell.
- Native inputs are used where the platform has a good one (`type="date"`, `type="file"`, `type="number"`).

### Overlays (`ui/overlay.tsx`, `ui/sheet.tsx`)

| Component | Use it for |
|---|---|
| `Tip` | A visual label for a control that already has an accessible name |
| `Popover` | A panel anchored to its trigger: column filters, date window, full cell text |
| `Menu` | A list of actions or toggles: upload, exclusions, columns, account |
| `Select` | Picking one value from a short list |
| `Dialog` | A short modal task with a clear outcome |
| `Sheet` | Long read-only content beside the table (agent report) |

Dialogs that edit one row open with a summary of that row (organisation and brief) so the user can see what they are changing.

### Data table (`data-table/`)

The table is controlled: rows, total, page, sort, filters and column visibility all come in as props with change callbacks. It owns only view state (column widths, scroll position).

- **Header:** one row, 40px tall. Label (with optional small provenance text under it), sort arrow, filter button. Clicking the label sorts descending, then ascending. The filter button is tinted when that column has an active filter.
- **Filter popover:** a "Contains" search box, then the column's typed control: multi-select list (options fetched when the popover opens), date range with optional presets, yes/no, or a custom control supplied by the column. "Clear" removes that column's filters.
- **Filter bar:** every active filter is a chip above the table, including filters that live outside the columns, passed in as `extraChips`. A filter the user cannot remove is shown as a chip without a remove button. Nothing narrows the list invisibly.
- **Cells:** text is capped at three lines (`max-h-[3lh]`). Longer text scrolls inside the cell with the scrollbar hidden. A cell is a live scroller only while hovered (`overflow-hidden hover:overflow-y-auto no-scrollbar`), always on touch screens (`pointer-coarse:overflow-y-auto`); a scroller in every cell makes table scroll choppy. No ellipsis, no click-to-expand popover.
- **Pinned columns:** sticky to the left, capped at half the table's width (`MAX_FROZEN_SHARE`); beyond that the rightmost pinned columns scroll with the rest.
- **Rows** are virtualised, so a 500-row page scrolls smoothly.
- **Column resize:** drag the header edge (pointer capture, 50px minimum). Widths are not persisted.
- **States:** skeleton on first load only; progress bar plus dimmed rows on later loads, with the old rows kept in place; an error state with "Try again"; an empty state that offers to reset column filters.
- **Footer:** range and total, rows per page (10, 25, 50, 100, 500), first/previous/window of five/next/last.

### Column definitions

A page describes its table as `DataTableColumn<Row>[]` (see `data-table/types.ts`). Per column: `id`, `header`, `width`, `frozen`, `hidden`, `sortable`, `search`, `filter`, `extraFilters`, `badges`, and either `text` (plain text for the default capped, scrollable cell) or `cell` (a renderer).

- A cell that edits data is its own small component: it dispatches the existing thunk, tracks its own pending state, shows a toast on success or failure, and owns any dialog it opens. The page holds no per-row dialog state.
- Editing in place is preferred for one-field changes (decision toggles, selects, remarks). A dialog is used when the change needs context or more than one input.
- A change shows immediately as pending and reverts with an error toast if the server refuses it.
- Edit affordances are small ghost icon buttons that are always visible, not revealed on hover.

## Feedback

- **Status:** progress bar while a page loads; "n matching" beside the title updates live.
- **Completion:** a success toast naming what changed ("APM set to YES", "Website saved").
- **Warning:** before a bulk action, a dialog states how many rows it affects.
- **Error:** a toast with the server's message; the control returns to its previous value.

Long-running work (export, bulk AI analysis) reports progress and, where it can be interrupted, turns its button into a Stop control.

## Writing

- Sentence case everywhere.
- Name things by what they contain or do.
- Say what is true now: "No tenders match these filters", "Assignment is locked once a person is allocated".
- Avoid jargon the user did not bring. Keep domain terms users already use (APP, APS, APM, EMD, GeM).

## Adding a page to v2

1. Create `app/(v2)/v2/<page>/page.tsx` rendering a view from `components/v2/<page>/`.
2. Write a hook that wires the page's existing slices and thunks, following `components/v2/tenders/use-tenders.ts`.
3. Write `columns.tsx` and `cells.tsx` for the page.
4. Compose header, optional summary strip and `DataTable` in the view.
5. Set `v2: true` and the new `href` on the page's entry in `components/v2/shell/nav-items.ts`.
6. Check light and dark, keyboard-only use, and reduced motion.
