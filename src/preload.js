'use strict';

const { ipcRenderer, shell } = require('electron');
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

function $(tagName, html) {
    const node = document.createElement(tagName);
    node.innerHTML = html;
    return node;
}

async function readGraffle(filePath) {
    const content = await readFile(filePath);
    const starter = content.readUInt16LE(0);
    if (starter === 0x8b1f) {
        const xml = await unzipAsync(content);
        return plist.parse(xml.toString('utf-8'));
    } else if (starter === 0x3f3c) {
        return plist.parse(content.toString('utf-8'));
    } else {
        const zip = new StreamZip.async({ file: filePath });
        const entries = await zip.entries();
        const filteredEntries = Object.values(entries).map((entry) => {
            return {
                name: entry.name,
                size: entry.size
            };
        });

        console.log(filteredEntries);

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
        this.element.classList.add('side-widget');
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

class MainWidget extends Widget {
    constructor(controller) {
        super();
        this.controller = controller;
        this.element.classList.add('main-widget');
        this.controller.on('preview', (event) => {
            this.preview(event);
        });
        const filename = document.createElement('div');
        filename.classList.add('filename');
        this.element.appendChild(filename);
        this.filenameElement = filename;
        const box = document.createElement('div');
        box.classList.add('preview');
        this.element.appendChild(box);
        this.previewBox = box;
        this.currentPath = '';
        delegate(this.element, 'dblclick', 'preview', this._onDBClick.bind(this))
    }

    _onDBClick(event) {
        if (this.currentPath) {
            shell.openPath(this.currentPath);
        }
    }

    async preview(grafflePath) {
        try {
            this.currentPath = grafflePath;
            this.previewBox.innerHTML = '';
            this.filenameElement.innerText = grafflePath;
            const graffle = await readGraffle(grafflePath);
            console.log(graffle);
            if (graffle) {
                this.previewBox.appendChild($('div', `版面：${graffle['Sheets'].length}`));
                if (graffle['!Preview']) {
                    const img = new Image();
                    img.src = 'data:image/jpeg;base64,' + graffle['!Preview'].data.toString('base64');
                    box.appendChild(img);
                    this.previewBox.appendChild(box);
                } else {
                    const noPreview = document.createElement('div');
                    noPreview.innerText = "no preview";
                    this.previewBox.appendChild(noPreview);
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
    const mainWidget = new MainWidget(controller);
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
        sideWidget.addItem({
            path: path.join(projectDir, item),
            name: item
        });
    }
}
