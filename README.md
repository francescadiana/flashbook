# @diana.inkkk · Flashbook

A flippable tattoo flashbook that reads its content from a Google Sheet.
It is mobile first: on phones (and tablets held upright) you see **one page at a time, nearly full screen**, at real size.
On a computer or a wide tablet you get the two-page open book.

- Post-it tabs on the right jump to each chapter
- 4 flashes per page on a computer, 2 bigger ones on a phone (stacked when held upright, side by side when held sideways). Extra flashes flow onto new pages automatically
- Tap or click a flash to see it bigger, with size, price and a DM button
- Arrows, swipe, or the ← → keys turn the pages. On a phone the bar at the bottom shows the chapter and page number
- **"Provatelo addosso"**: try any flash on yourself with the camera, take a photo and save it to the device
- **Direct link for every flash**, ready for Instagram stories

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
| cover_tags | Small labels on the cover, separated by commas (e.g. `Napoli`). Labels like "Vol. 01" are never shown |
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
| id | Optional. A fixed name for the flash's direct link (see section 4) |

To add a chapter, add a row in **Chapters** and use its name in **Sketches**. To rename a chapter, rename it in both tabs.

## 4. Languages (Italiano / English)

The cover has an **IT / EN** switch. The choice is remembered on the visitor's device; the first time, the browser language decides.
Everything fixed in the book (buttons, labels, page texts, camera messages) is translated. The texts you write in your Sheet are translated like this:

- **With columns/rows named `..._it` or `..._en`.** In *Sketches* add `title_it`, `notes_it` (and `title_en`, ...). In *Chapters* add `chapter_it`, `blurb_it`. In *Intro* add rows like `greeting_it`, `intro_text_it`, `signoff_it`. The version in the visitor's language is used; if it is empty, the normal column is shown.
- **Or in `js/config.js`**, in the `translations` list: `"text as written in the Sheet": "translated text"`. Handy for chapter names and the intro.

Links to a flash (section 5) are the same in both languages.

## 5. "Provatelo addosso" (try it on) and story links

### Try it on
Open any flash and press **Provatelo addosso**. The camera opens with the flash on top:
drag to move it, pinch to resize and rotate (on a computer: mouse wheel to resize, Shift + wheel to rotate, or use the sliders).
The white of the drawing is always transparent, so it looks like ink on skin.
Press the round button to take the photo, then **Salva foto** (on iPhone a menu opens: choose *Salva immagine*).
Photos never leave the visitor's device.

The button is hidden for flashes without an image. Camera access needs the https link (GitHub Pages is fine).
If the camera is blocked (typical inside Instagram's own browser) visitors get a button to take/upload a photo instead,
plus a hint to open the link in Safari/Chrome.
For saving to work, the image must allow it: files in the `flashes/` folder always work; Google Drive images normally do.

### Direct link for every flash
Open a flash and press **Copia link per le storie**. Then, in an Instagram story, add the **Link** sticker and paste.
The link looks like `https://YOUR-USERNAME.github.io/flashbook/#f/animals-sample-flash-1`
and opens the book on that page with the flash already open.

- Every new row in the Sheet gets its link automatically, built from `chapter + title`.
- Renaming a flash or its chapter changes its link. To keep a link forever, add an optional column called **`id`** to the Sketches tab and write a short name there (for example `gatto-1`): the link becomes `#f/gatto-1`.
- Hiding a flash (`status = hidden`) does not change the links of the others.

## Troubleshooting

- **A message says it "couldn't read the Google Sheet".** Check that the file was saved as a Google Sheet (step 2.2), that it's shared *Anyone with the link*, and that the tabs are still named `Intro`, `Chapters`, `Sketches`. If you rename them, change the names in `js/config.js` too.
- **A flash shows "drawing coming soon".** Its `image_link` is empty or the image isn't shared publicly.
- **Change how many flashes fit on a page:** `perPage` (computer, default 4) and `perPageMobile` (phone, default 2) in `js/config.js`.
- **Text size on phones:** phones show the page at real size, so text is always at least 16px. `mobileTextSize` in `js/config.js` only affects small desktop windows.
- **Update the logo:** replace `assets/logo.png`, using the same file name.

## Files

```
index.html               the page
css/style.css            look & feel (colors at the top)
js/config.js             your settings: Sheet ID, flashes per page
js/app.js                the book engine
js/ar.js                 "Provatelo addosso": camera, overlay, photo capture (texts at the top)
assets/logo.png          logo (also the browser tab icon)
assets/logo-serigrafia.png  the screen-printed logo on the cover (+ cloth.png and ink-grain.png textures)
data/*.csv               demo content, used when no Sheet is connected
flashes/                 optional: put image files here instead of Drive
sheet-template/          the Google Sheet template to upload to Drive
```
