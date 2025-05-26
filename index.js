import { promises as fsp } from "fs";
import chokidar from "chokidar";
import config from "./config.js";
import matter from "gray-matter";

/**
 * Notes
 */
let allNotes = {};

function getNote(fileName) {
  const fileWithFrontmatter = matter.read(
    config.vaultNotesPath + "/" + fileName
  );

  return {
    fileName,
    vaultTitle: fileName.split(".md")[0],
    file: fileWithFrontmatter,
  };
}

async function readNotes() {
  let noteFileNames = await fsp.readdir(config.vaultNotesPath);
  noteFileNames = noteFileNames.filter((fileName) => fileName.endsWith(".md"));
  let notes = noteFileNames.map((noteFileName) => getNote(noteFileName));
  // filter out null values
  notes = notes.filter((note) => note);
  for (const note of notes) {
    allNotes[note.fileName] = note;
  }
}

async function cleanUpNotes() {
  // remove all files in the astro notes path that are not in the published notes path
  const astroNotes = await fsp.readdir(config.astroNotesPath);
  const publishedNotes = await fsp.readdir(config.vaultNotesPath);
  const publishedNotesSlugs = publishedNotes.map(
    (note) => matter.read(config.vaultNotesPath + "/" + note).data.slug
  );
  const notesToRemove = astroNotes.filter((note) => {
    const noteSlug = matter.read(config.astroNotesPath + "/" + note).data.slug;
    return !publishedNotesSlugs.includes(noteSlug);
  });
  await Promise.all(
    notesToRemove.map((note) => fsp.unlink(config.astroNotesPath + "/" + note))
  );
}

const linksRegex = /\[\[(.+?)\]\]/g;

function processNote(note) {
  // update frontmatter - site_tags to tags
  note.file.data.tags = note.file.data.site_tags;
  delete note.file.data.site_tags;

  // check for wikilinks
  const matches = note.file.content.match(linksRegex);
  if (matches) {
    matches.forEach((match) => {
      const link = match.slice(2, -2);
      const linkParts = link.split("|");
      const linkText = linkParts[1] || linkParts[0];
      const linkedNote = Object.values(allNotes).find(
        (note) => note.vaultTitle === linkParts[0]
      );
      // if there is a linked note, replace with markdown link
      if (linkedNote) {
        note.file.content = note.file.content.replace(
          match,
          `[${linkText}](/${linkedNote.file.data.slug}/)`
        );
      } else {
        // if there is no linked note, remove wikilink
        note.file.content = note.file.content.replace(match, linkText);
      }
    });
  }

  // replace images with file:// src with relative src
  if (config.replaceFileSystemImageSrc) {
    const fileRegex = new RegExp(`file://${config.vaultPath}`, "g");
    note.file.content = note.file.content.replace(fileRegex, "");
  }

  return note;
}

function writeNote(note) {
  if (!note) {
    console.log(note);
  }
  const processedNote = processNote(note);
  console.log(
    `Writing ${note.fileName} to ${processedNote.file.data.slug}.md...`
  );
  return fsp.writeFile(
    config.astroNotesPath + "/" + processedNote.file.data.slug + ".md",
    matter.stringify(processedNote.file)
  );
}

async function updateNote(path) {
  const fileName = path.split("/").pop();
  const note = await getNote(fileName);
  if (!note) return;
  allNotes[note] = note;
  writeNote(note);
}

/**
 * Images
 */

async function copyImages() {
  const images = await fsp.readdir(config.vaultImagesPath);
  return Promise.all(images.map((image) => copyImage(image)));
}

function isImageInNoteContent(image) {
  return Object.values(allNotes).some((note) =>
    note.file.content.includes(image)
  );
}

async function copyImage(image) {
  if (!isImageInNoteContent(image)) return;
  console.log(`Copying ${image}...`);
  return fsp.copyFile(
    config.vaultImagesPath + "/" + image,
    config.astroImagesPath + "/" + image
  );
}

/**
 * Watchers
 */

function startWatcher() {
  console.log(
    `Watching ${config.vaultNotesPath} and ${config.vaultImagesPath} for changes...`
  );
  const noteWatcher = chokidar.watch(config.vaultNotesPath, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
  });
  noteWatcher
    .on("add", (path) => updateNote(path))
    .on("change", (path) => updateNote(path));

  const imagesWatcher = chokidar.watch(config.vaultImagesPath, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
  });
  imagesWatcher.on("add", (path) => copyImage(path.split("/").pop()));
}

// Read all notes, copy all images, start the watcher
readNotes().then(cleanUpNotes).then(copyImages).then(startWatcher);
