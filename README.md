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

When using `<img>` tags in Obsidian, relative file paths don't display the image inline. To see the image you need to point the src directly to the file with a `file:///` link. If you have `img` tags in your vault and you want these changed to relative links while being processed, you can include these options in your config:

```js
  replaceFileSystemImageSrc: true,
  vaultPath: "PATH_TO_VAULT"
```

---

This is the script I use to copy the notes in my Obsidian vault to the repo for my site - https://github.com/rachsmithcodes/rachsmith.com.
