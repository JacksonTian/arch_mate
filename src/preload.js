'use strict';

const { ipcRenderer } = require('electron');
const path = require('path');
const { readdir, stat, readFile } = require('fs').promises;
const { unzip } = require('zlib');
const StreamZip = require('node-stream-zip');
const { EventEmitter } = require('events');

function unzipAsync(buffer) {
    return new Promise((resolve, reject) => {
        unzip(buffer, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result);
        });
    });
}

const plist = require('plist');

async function readGraffle(filePath) {
    const content = await readFile(filePath);
    if (content.readUInt16LE(0) === 0x8b1f) {
        const xml = await unzipAsync(content);
        return plist.parse(xml.toString('utf-8'));
    } else {
        const zip = new StreamZip.async({ file: filePath });
        const entries = await zip.entries();
        const filteredEntries = Object.values(entries).map((entry) => {
            return {
                name: entry.name,
                size: entry.size,
                dir: entry.isDirectory,
            };
        });

        const entryData = await zip.entryData('data.plist');
        const graffle = plist.parse(entryData.toString('utf-8'));
        graffle['!Preview'] = {
            type: 'jpeg',
            data: await zip.entryData('preview.jpeg')
        };
        await zip.close();
        return graffle;
    }
}

// const [grafflePath] = process.argv.slice(2);
// const content = readFileSync(grafflePath);
// const xml = unzipSync(content).toString('utf-8');
// const graffle = plist.parse(xml);

// writeFileSync(grafflePath + '.' + graffle['!Preview'].type, graffle['!Preview'].data);
// console.log(graffle.ApplicationVersion.join(':'));
// console.log(graffle.CreationDate);
// console.log(graffle.Creator);

class Controller extends EventEmitter {

}

class Widget {
    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('widget');
    }

    show(parent) {
        parent.appendChild(this.element);
    }
}

class VBox extends Widget {
    constructor() {
        super();
        this.element.classList.add('vbox');
    }
}

class RootView extends VBox {
    constructor() {
        super();
        this.element.classList.add('root-view');
    }

    setWidget(widget) {
        widget.show(this.element);
    }

    attachToDocument(parent) {
        parent.appendChild(this.element);
    }
}

class SplitWidget extends Widget {
    constructor() {
        super();
        this.element.classList.add('split-widget');
    }

    setSideWidget(widget) {
        widget.show(this.element);
    }

    setMainWidget(widget) {
        widget.show(this.element);
    }
}

function delegate(box, eventName, klass, handler) {
    box.addEventListener(eventName, function (event) {
        let current = event.target;
        while (current !== box) {
            if (current.classList.contains(klass)) {
                event.current = current;
                handler(event);
                break;
            }
            current = current.parentElement;
        }
    }, false);
}

class ListWidget extends Widget {
    constructor(controller) {
        super();
        this.controller = controller;
        this.element.classList.add('list-widget');
        this.listElement = document.createElement('ul');
        this.element.appendChild(this.listElement);
        delegate(this.listElement, 'click', 'item', this._onClick.bind(this))
    }

    addItem(item) {
        if (item.isFolder) {
            return;
        }
        const i = document.createElement('li');
        i.classList.add('item');
        i.setAttribute('data-path', item.path);
        const title = document.createElement('div');
        title.innerText = `${item.name}`;
        i.appendChild(title);
        this.listElement.appendChild(i);
    }

    _onClick(event) {
        let current = event.current;
        this.controller.emit('preview', current.getAttribute('data-path'));
    }
}

class PreviewWidget extends Widget {
    constructor(controller) {
        super();
        this.controller = controller;
        this.element.classList.add('preview');
        this.controller.on('preview', (event) => {
            this.preview(event);
        });
    }

    async preview(grafflePath) {
        this.element.innerHTML = '';
        try {
            const graffle = await readGraffle(grafflePath);
            if (graffle) {
                if (graffle['!Preview']) {
                    const img = new Image();
                    img.src = 'data:image/' + graffle['!Preview'].type + ';base64,' + graffle['!Preview'].data.toString('base64');
                    this.element.appendChild(img);
                } else {
                    const noPreview = document.createElement('div');
                    noPreview.innerText = "no preview";
                    this.element.appendChild(noPreview);
                }
            }
        } catch (ex) {
            console.log(ex.stack);
        }
    }
}

async function render() {
    const controller = new Controller();
    const rootView = new RootView(controller);
    const splitWidget = new SplitWidget(controller);
    const sideWidget = new ListWidget(controller);
    const projectDir = await ipcRenderer.invoke('get_project_dir');
    if (projectDir) {
        document.title = projectDir;
        await renderList(sideWidget, projectDir);
    }
    splitWidget.setSideWidget(sideWidget);
    const mainWidget = new PreviewWidget(controller);
    splitWidget.setMainWidget(mainWidget);
    rootView.setWidget(splitWidget);
    rootView.attachToDocument(document.body);
}

window.addEventListener('DOMContentLoaded', render);

async function renderList(sideWidget, projectDir) {
    const list = await readdir(projectDir);
    const graffleList = list.filter((item) => {
        return item.endsWith('.graffle');
    });

    for (let i = 0; i < graffleList.length; i++) {
        const item = graffleList[i];
        const fileStat = await stat(path.join(projectDir, item));
        await sideWidget.addItem({
            isFolder: fileStat.isDirectory(),
            path: path.join(projectDir, item),
            name: item
        });
    }
}
