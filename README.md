# obsidian-to-astro-sync
A Node.js script to sync your [Obsidian](https://obsidian.md/) notes with your [Astro](https://astro.build/) content.

## Instructions
- download the repo contents
- update the file paths in config.js to point to the location of the images and notes in your vault, and the images and notes in your Astro site.
- run `npm install`
- run `npm run start` to start the script.

All notes in your vault with the property `publish` will be copied to the designated folder in Obsidian.

Any internal wikilinks in the original markdown file will be processed:
- If the link points to another published note, it is replaced with an anchor link to that note.
- If it points to a private note in your vault, the link syntax (`[[ ]]`) is removed

---

This is the script I use to copy the notes in my Obsidian vault to the repo for my site - https://github.com/rachsmithcodes/rachsmith.com.
