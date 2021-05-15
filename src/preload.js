'use strict';

const { ipcRenderer } = require('electron');
const path = require('path');
const { readdirSync, statSync, readFileSync } = require('fs');
const { unzipSync } = require('zlib');
const StreamZip = require('node-stream-zip');

const plist = require('plist');

// const [grafflePath] = process.argv.slice(2);
// const content = readFileSync(grafflePath);
// const xml = unzipSync(content).toString('utf-8');
// const graffle = plist.parse(xml);

// writeFileSync(grafflePath + '.' + graffle['!Preview'].type, graffle['!Preview'].data);
// console.log(graffle.ApplicationVersion.join(':'));
// console.log(graffle.CreationDate);
// console.log(graffle.Creator);


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

class ListWidget extends Widget {
    constructor() {
        super();
        this.element.classList.add('list-widget');
        this.listElement = document.createElement('ul');
        this.element.appendChild(this.listElement);

        this.listElement.addEventListener('click', this._onClick.bind(this), false);
    }

    addItem(item) {
        if (item.isFolder) {
            return;
        }
        const i = document.createElement('li');
        i.classList.add('item');
        i.setAttribute('data-name', item.name);
        const title = document.createElement('div');
        title.innerText = `${item.name}: is folder: ${item.isFolder}`;
        i.appendChild(title);

        try {
            const content = readFileSync(item.path);
            console.log(content.readUInt16LE(0).toString(16));
            if (content.readUInt16LE(0) === 0x8b1f) {
                const xml = unzipSync(content).toString('utf-8');
                const graffle = plist.parse(xml);
                if (graffle['!Preview']) {
                    const img = new Image();
                    img.width = 100;
                    img.height = 100;
                    img.src = 'data:image/'+ graffle['!Preview'].type + ';base64,' + graffle['!Preview'].data.toString('base64');
                    i.appendChild(img);
                } else {
                    const noPreview = document.createElement('div');
                    noPreview.innerText = "no preview";
                    i.appendChild(noPreview);
                }
            }
        } catch (ex) {
            console.log(ex.stack);
        }
        this.listElement.appendChild(i);
    }

    _onClick(event) {
        console.log(event);
        const target = event.target;
        if (target.classList.contains('item')) {
            console.log(target.getAttribute('data-name'));
        }
        // var breadcrumbElement = event.target.enclosingNodeOrSelfWithClass('ax-breadcrumb');
        // if (!breadcrumbElement) {
        //   this._setHoveredBreadcrumb(null);
        //   return;
        // }
        // var breadcrumb = breadcrumbElement.breadcrumb;
        // if (breadcrumb.inspected()) {
        //   // If the user is clicking the inspected breadcrumb, they probably want to
        //   // focus it.
        //   breadcrumb.element().focus();
        //   return;
        // }
        // if (!breadcrumb.isDOMNode())
        //   return;
        // this._inspectDOMNode(breadcrumb.axNode());
    }
}

class PreviewWidget extends Widget {
    constructor() {
        super();
        this.element.classList.add('preview');
    }
}

async function render() {
    const rootView = new RootView();
    const splitWidget = new SplitWidget();
    const sideWidget = new ListWidget();
    const projectDir = await ipcRenderer.invoke('get_project_dir');
    if (projectDir) {
        document.title = projectDir;
        renderList(sideWidget, projectDir);
    }
    splitWidget.setSideWidget(sideWidget);
    const mainWidget = new PreviewWidget();
    splitWidget.setMainWidget(mainWidget);
    rootView.setWidget(splitWidget);
    rootView.attachToDocument(document.body);
}

window.addEventListener('DOMContentLoaded', render);

function renderList(sideWidget, projectDir) {
    const list = readdirSync(projectDir).filter((item) => {
        return item.endsWith('.graffle');
    }).map((item) => {
        return {
            isFolder: statSync(path.join(projectDir, item)).isDirectory(),
            path: path.join(projectDir, item),
            name: item
        };
    });

    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        sideWidget.addItem(item);
    }
}
