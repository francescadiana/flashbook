# @diana.inkkk · Flashbook

A flippable tattoo flashbook that reads its content from a Google Sheet.
It works on desktop and on phones held sideways (landscape).

- Post-it tabs on the right jump to each chapter
- 4 flashes per page. Extra flashes flow onto new pages automatically
- Tap or click a flash to see it bigger, with size, price and a DM button
- Arrows, swipe, or the ← → keys turn the pages

---

## 1. Put it online with GitHub Pages (one time)

1. Create a free account on [github.com](https://github.com) if you don't have one.
2. Click **+ → New repository**. Name it, for example, `flashbook`. Set it to **Public** and click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
4. Unzip `flashbook.zip` on your computer. Open the unzipped folder, select **everything inside it** (not the folder itself) and drag it into the GitHub page. Click **Commit changes**.
5. Go to **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, then click **Save**.
6. Wait 1–2 minutes and refresh. Your link appears at the top of that page, like
   `https://YOUR-USERNAME.github.io/flashbook/`

Until you connect your Sheet (step 2), the site shows demo pages.

## 2. Connect your Google Sheet (one time)

1. Upload `sheet-template/flashbook-sheet.xlsx` to Google Drive.
2. Open it, then choose **File → Save as Google Sheets**. This step matters: an uploaded Excel file won't work, only a real Google Sheet.
3. Click **Share**, then under *General access* choose **Anyone with the link → Viewer**.
4. Copy the long code from the Sheet's address bar:
   `https://docs.google.com/spreadsheets/d/`**`1AbC...xyz`**`/edit`
5. On GitHub, open `js/config.js`, click the pencil icon, and paste the code between the quotes:
   ```js
   sheetId: "1AbC...xyz",
   ```
   Click **Commit changes**. The site updates in about a minute.

## 3. Everyday use: just edit the Sheet

You never need to touch GitHub again. Changes in the Sheet show up when the page is reloaded. Google can take up to about 5 minutes to refresh.

### Add a new sketch
1. Scan or photograph the sketch. A white background, cropped close, looks best.
2. Upload it to a Google Drive folder (for example *Flashbook*). Share that folder as **Anyone with the link → Viewer**, once, and every file inside it becomes visible.
3. Right-click the image → **Share → Copy link**.
4. Add a row in the **Sketches** tab and paste the link in `image_link`.

### The three tabs

**Intro** — one row per setting

| field | what it does |
|---|---|
| greeting | The black label on the intro page ("Hey you!") |
| intro_text | Your intro. Press Ctrl+Enter (Cmd+Enter on Mac) inside the cell to start a new line |
| photo_link | Drive link to a photo of you (optional; the logo is shown if empty) |
| instagram | Your handle, without @. Used for every DM button |
| booking_note | Optional handwritten note on the booking page (deposit, aftercare…) |
| cover_title | Big title on the cover (default FLASHBOOK) |
| cover_tags | Small labels on the cover, separated by commas (e.g. `Vol. 01, Napoli`) |
| signoff | Handwritten line on the last page |

**Chapters** — one row per post-it

| column | what it does |
|---|---|
| order | Position of the tab (1 = top) |
| chapter | Chapter name. Must match the `chapter` column in Sketches |
| tab_color | `green`, `mint`, `black`, `white`, or any hex color like `#FF6B6B` |
| blurb | Optional one-liner under the chapter name |

**Sketches** — one row per flash

| column | what it does |
|---|---|
| chapter | Which chapter it belongs to (a dropdown of your chapters) |
| order | Order inside the chapter |
| title | Name of the flash |
| image_link | Google Drive link (or any image URL, or a file in the repo's `flashes/` folder, e.g. `flashes/cat.jpg`) |
| size_cm | Just a number (`8`) becomes "8 cm"; you can also write `8–10 cm` |
| price | Just a number (`80`) becomes "€80"; or write text like `from €60` |
| status | `available`, `tattooed` (shows a TAKEN stamp), or `hidden` (not shown) |
| notes | Optional text shown in the enlarged view |

To add a chapter, add a row in **Chapters** and use its name in **Sketches**. To rename a chapter, rename it in both tabs.

## Troubleshooting

- **A message says it "couldn't read the Google Sheet".** Check that the file was saved as a Google Sheet (step 2.2), that it's shared *Anyone with the link*, and that the tabs are still named `Intro`, `Chapters`, `Sketches`. If you rename them, change the names in `js/config.js` too.
- **A flash shows "drawing coming soon".** Its `image_link` is empty or the image isn't shared publicly.
- **Change how many flashes fit on a page:** `perPage` in `js/config.js`.
- **Update the logo:** replace `assets/logo.png`, using the same file name.

## Files

```
index.html               the page
css/style.css            look & feel (colors at the top)
js/config.js             your settings: Sheet ID, flashes per page
js/app.js                the book engine
assets/logo.png          logo (also the browser tab icon)
data/*.csv               demo content, used when no Sheet is connected
flashes/                 optional: put image files here instead of Drive
sheet-template/          the Google Sheet template to upload to Drive
```
