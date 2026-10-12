# ServiceOps Icon Library

Every icon used in Motadata ServiceOps and its Dashboards module, on one standalone page.

Live: https://zenichakalasiya.github.io/serviceops-icon-library/

- Two sets, each kept in its own groups: **ServiceOps** (265 icons) and **Dashboard** (164 icons).
- Click an icon to copy or download it as SVG, PNG (1x, 2x, 4x), a React or Vue component, or its lucide import.
- Hover a tile for quick copy and download. One search covers both sets.
- Link straight to an icon: `#/serviceops/ChevronDown`, `#/dashboard/chart-donut`.

## Updating the icons

The page is one generated file, `index.html`. The icons are read off the two live icon pages:

- https://ronak-patel-motadata.github.io/ServiceOps-Ticket-Detail-/ (Icon Library, bottom of the left sidebar)
- https://zenichakalasiya.github.io/ServiceOps_Dashboard_v2/#/icons

```
node src/scrape.mjs data/icons-raw.json   # needs playwright-core and Chrome; edit the import path at the top
node build.mjs                            # writes index.html
```

Then commit and push to `main`. GitHub Pages serves the repository root.
