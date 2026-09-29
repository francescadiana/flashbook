/*
 * FLASHBOOK SETTINGS — the only file you need to edit.
 *
 * sheetId: the long code in your Google Sheet's address, between /d/ and /edit
 *   https://docs.google.com/spreadsheets/d/  THIS_PART_HERE  /edit
 *   Leave it empty ("") to show the demo data in the /data folder.
 *
 * The Sheet must be shared as "Anyone with the link: Viewer".
 */
window.FLASHBOOK_CONFIG = {
  sheetId: "",

  // Tab names inside the Sheet (change only if you rename the tabs)
  tabs: { intro: "Intro", chapters: "Chapters", sketches: "Sketches" },

  // How many flashes fit on one page (computer / phone)
  perPage: 4,
  perPageMobile: 2,

  // Text size on phones (1 = same as computer, smaller number = smaller text)
  mobileTextSize: 0.72,

  // Currency shown before numeric prices
  currency: "€"
};
