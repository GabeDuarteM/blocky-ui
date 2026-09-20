---
"blocky-ui": patch
---

Mobile query logs and consistent dashboard controls

## Highlights

The dashboard is easier to read and use on smaller screens, with a compact query-log layout and more consistent controls throughout.

### Mobile query logs

- Show the domain and client in two-line rows, with the reason badge and time alongside them.
- Expand a row inline to see its record type, duration, reason details, server when applicable, and full timestamp. Long domain and client names remain available in the expanded view.

### Pagination

- Use the same grouped pagination controls in Query Logs, Top Clients, and Top Domains.
- Show `1 / …` while the total page count is loading, keeping the controls steady as the count arrives.
- Give mobile controls larger touch targets and keep the rows-per-page selector readable at every size.

### Dashboard controls

- Align the sizing and appearance of fields, filters, buttons, and status badges across the dashboard.

![Mobile query logs with two demo results, inline details, and single-page pagination](https://github.com/user-attachments/assets/e31d131c-3ead-4ced-b7de-5eca1452989a)
