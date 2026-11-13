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
  sheetId: "1CnAoKKc11uBspUojpvvWKdEYHACpsLBlm7d-b7hfZuU",

  // Tab names inside the Sheet (change only if you rename the tabs)
  tabs: { intro: "Intro", chapters: "Chapters", sketches: "Sketches" },

  // How many flashes fit on one page (computer / phone)
  perPage: 4,
  perPageMobile: 2,

  // Text size on phones (1 = same as computer, smaller number = smaller text)
  mobileTextSize: 0.72,

  // Currency shown before numeric prices
  currency: "€",

  // Translations of the texts you write in the Google Sheet.
  // Best way: add columns/rows named like the original with _it or _en (title_it, notes_en, greeting_it ...).
  // Quick way: list here "text as written in the Sheet": "translated text", for each language.
  translations: {
    it: {
      "Hey you!": "Ciao!",
      "I'm a tattoo beginner based in Naples, city center.\nThese are some of my flashes: have a look and reach out!":
        "Sono agli inizi con il tatuaggio, a Napoli, in centro.\nQuesti sono alcuni dei miei flash: dai un'occhiata e scrivimi!",
      "see you in Naples!": "ci vediamo a Napoli!",
      "Animals": "Animali",
      "Stamps": "Francobolli",
      "Symbols": "Simboli"
    },
    en: {
      // e.g. "Animali": "Animals"
    }
  }
};
