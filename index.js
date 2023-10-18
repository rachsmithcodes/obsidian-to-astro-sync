import { promises as fsp } from "fs";
import chokidar from "chokidar";
import config from "./config.js";

/**
 * Notes
 */
let allNotes = {};

async function getNote(fileName) {
  const noteContent = await fsp.readFile(
    config.vaultNotesPath + "/" + fileName,
    "utf-8"
  );

  if (noteContent.indexOf("---") != 0) return null;

  const frontmatterText = noteContent.split("---")[1];
  // convert frontmatter to object
  const frontmatter = frontMatterToObject(frontmatterText);

  if (!frontmatter.slug) return null;
  if (!frontmatter.publish) return null;

  return {
    fileName,
    vaultTitle: fileName.split(".md")[0],
    slug: frontmatter.slug,
    content: noteContent,
  };
}

function frontMatterToObject(frontmatterText) {
  return frontmatterText.split("\n").reduce((object, line) => {
    const [key, value] = line.split(":");
    if (key && value) {
      // some yaml strings are quoted
      if (value.trim().indexOf('"') == 0) {
        object[key.trim()] = value.trim().slice(1, -1);
      } else {
        object[key.trim()] = value.trim();
      }
    }
    return object;
  }, {});
}

async function readNotes() {
  let noteFileNames = await fsp.readdir(config.vaultNotesPath);
  noteFileNames = noteFileNames.filter((fileName) => fileName.endsWith(".md"));
  let notes = await Promise.all(
    noteFileNames.map((noteFileName) => getNote(noteFileName))
  );
  // filter out null values
  notes = notes.filter((note) => note);
  for (const note of notes) {
    allNotes[note.fileName] = note;
  }
}

const linksRegex = /\[\[(.+?)\]\]/g;

function processNote(note) {
  // check for wikilinks
  const matches = note.content.match(linksRegex);
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
        note.content = note.content.replace(
          match,
          `[${linkText}](/${linkedNote.slug}/)`
        );
      } else {
        // if there is no linked note, remove wikilink
        note.content = note.content.replace(match, linkText);
      }
    });
  }

  // replace images with file:// src with relative src
  if (config.replaceFileSystemImageSrc) {
    const fileRegex = new RegExp(`file://${config.vaultPath}`, "g");
    note.content = note.content.replace(fileRegex, "");
  }

  return note;
}

function writeNote(note) {
  if (!note) {
    console.log(note);
  }
  console.log(`Writing ${note.fileName}...`);
  const processedNote = processNote(note);
  return fsp.writeFile(
    config.astroNotesPath + "/" + processedNote.slug + ".md",
    processedNote.content
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
  return Object.values(allNotes).some((note) => note.content.includes(image));
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
readNotes().then(copyImages).then(startWatcher);
