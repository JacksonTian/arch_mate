const { readFileSync, writeFileSync } = require("fs");
const { unzipSync } = require('zlib');
const StreamZip = require('node-stream-zip');

const plist = require('plist');

const [grafflePath] = process.argv.slice(2);
// const content = readFileSync(grafflePath);

async function main() {
    const zip = new StreamZip.async({ file: grafflePath });
    const entriesCount = await zip.entriesCount;
    console.log(`Entries read: ${entriesCount}`);

    const entries = await zip.entries();
    for (const entry of Object.values(entries)) {
        const desc = entry.isDirectory ? 'directory' : `${entry.size} bytes`;
        console.log(`Entry ${entry.name}: ${desc}`);
    }

    // Do not forget to close the file once you're done
    await zip.close();
}

main();

// const xml = unzipSync(content).toString('utf-8');
// const graffle = plist.parse(xml);

// writeFileSync(grafflePath + '.' + graffle['!Preview'].type, graffle['!Preview'].data);
// console.log(graffle.ApplicationVersion.join(':'));
// console.log(graffle.CreationDate);
// console.log(graffle.Creator);
