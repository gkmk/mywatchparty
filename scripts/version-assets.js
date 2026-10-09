// Append a content hash to main.css / main.js in index.html (?v=...) so
// browsers and GitHub Pages' cache pick up new versions right after a deploy.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const indexPath = path.join(root, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

for (const file of ["main.css", "main.js"]) {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex").slice(0, 8);
    html = html.replace(new RegExp(`(["'])${file.replace(".", "\\.")}(\\?v=[^"']*)?\\1`, "g"), `$1${file}?v=${hash}$1`);
}

fs.writeFileSync(indexPath, html);
