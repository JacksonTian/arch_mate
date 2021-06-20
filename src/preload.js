'use strict';

const { ipcRenderer, shell } = require('electron');
const path = require('path');
const { readdir, stat, readFile } = require('fs').promises;
const { unzip } = require('zlib');
const StreamZip = require('node-stream-zip');
const icc = require('icc');
const iconv = require('iconv-lite');
const rtf = require('@jacksontian/rtf-parser');
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
    const st = await stat(filePath);
    if (st.isDirectory()) {
        return await readGraffle(path.join(filePath, 'data.plist'));
    }

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

function parsePoint(point) {
    const matched = point.match(/\{(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\}/);
    return [parseFloat(matched[1]), parseFloat(matched[2])];
}

function parseBounds(bounds) {
    const matched = bounds.match(/\{\{(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\},\s*\{(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\}\}/);
    return [parseFloat(matched[1]), parseFloat(matched[2]), parseFloat(matched[3]), parseFloat(matched[4])];
}

const colorMap = {
    'systemRedColor': 'red'
};

const pattern = {
    '1': '5,5',
    '2': '1,4'
};

function getPath(path) {
    let data = '';
    for (let i = 0; i < path.elements.length; i++) {
        const d = path.elements[i];
        let [x, y] = parsePoint(d.point);
        if (i > 0) {
            data += ' ';
        }
        switch (d.element) {
            case 'MOVETO':
                data += `M${x} ${y}`;
                break;
            case 'LINETO':
                data += `L${x} ${y}`;
                break;
            case 'CURVETO':
                let [c1x, c1y] = parsePoint(d.control1);
                let [c2x, c2y] = parsePoint(d.control2);
                data += `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x} ${y}`;
                break;
            default:
                console.log(d);
                break;
        }
        // console.log(d);0: {element: "MOVETO", point: "{451.5, 132.5}"}
        // 1: {control1: "{451.5, 132.5}", control2: "{496.91744145677217, 37.80016998053074}", element: "CURVETO", point: "{588, 39.5}"}
        // 2: {control1: "{679.08255854322783, 41.19983001946926}", control2: "{773, 138.5}", element: "CURVETO", point: "{773, 138.5}"}
    }
    return data;
}

function getWidth(stroke, defValue = 1) {
    if (!stroke || !stroke.Width) {
        return defValue;
    }
    return stroke.Width;
}

function parseColor(d, defValue = 'none') {
    if (!d || !d.Color) {
        return defValue;
    }

    const c = d.Color;
    if (c.catalog === 'System') {
        console.log(c);
        return colorMap[c.name];
    }

    if (c.space === 'srgb') {
        return `rgb(${Math.floor(c.r * 256)}, ${Math.floor(c.g * 256)}, ${Math.floor(c.b * 256)})`;
    }

    return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

function decodeText(text) {
    const codes = [];
    let i = 0;
    while (i < text.length) {
        if (text[i] === '\\') {
            const code = text[i + 2] + text[i + 3];
            codes.push(parseInt(code, 16));
            i = i + 4;
        } else {
            codes.push(text[i].charCodeAt(0));
            i = i + 1;
        }
    }
    return iconv.decode(Buffer.from(codes), 'gb2312');
}

function getText(text) {
    const doc = rtf.parse(text);
    const group = doc.children[0];
    const t = group.children[group.children.length - 1];
    return decodeText(t.value);
}

function renderGraphic(g) {
    const svgNS = 'http://www.w3.org/2000/svg';
    if (g.Class === 'LineGraphic') {
        const path = document.createElementNS(svgNS, 'path');
        // <path d="M 175 200 l 150 0" stroke="green" stroke-width="3" fill="none" />
        path.setAttribute('d', getPath(g.LogicalPath));
        path.setAttribute("style", `stroke:${parseColor(g.Style.stroke, 'black')};stroke-width:1`);
        if (g.Style.fill && g.Style.fill.Draws === 'NO') {
            path.setAttribute('fill', 'none');
        } else {
            path.setAttribute("fill", parseColor(g.Style.fill, 'none'));
        }
        if (g.Style.stroke.Pattern) {
            path.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
        }
        // <line x1="0" y1="0" x2="200" y2="200" style="stroke:rgb(255,0,0);stroke-width:2"/>
        return path;
    }

    if (g.Class === 'ShapedGraphic' && g.Shape === 'Circle') {
//         <ellipse cx="300" cy="80" rx="100" ry="50"
//   style="fill:yellow;stroke:purple;stroke-width:2"/>
        const ellipse = document.createElementNS(svgNS, 'ellipse');
        const [x1, y1, width, height] = parseBounds(g.Bounds);
        ellipse.setAttribute('cx', x1 + width / 2);
        ellipse.setAttribute('cy', y1 + height / 2);
        ellipse.setAttribute('rx', width / 2);
        ellipse.setAttribute('ry', height / 2);
        if (g.Style.stroke && g.Style.stroke.Draws === 'NO') {
            ellipse.setAttribute("style", `fill:${parseColor(g.Style.fill, 'none')};stroke:none;stroke-width:1`);
        } else {
            ellipse.setAttribute("style", `fill:${parseColor(g.Style.fill, 'none')};stroke:${parseColor(g.Style.stroke, 'black')};stroke-width:${getWidth(g.Style.stroke, 1)}`);
        }
        // if (g.Style.stroke && g.Style.stroke.Pattern) {
        //     rect.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
        // }
        return ellipse;
    }

    if (g.Class === 'ShapedGraphic') {
        const rect = document.createElementNS(svgNS, 'rect');
        const [x1, y1, width, height] = parseBounds(g.Bounds);
        rect.setAttribute('x', x1);
        rect.setAttribute('y', y1);
        // rect.setAttribute('rx', x2);
        // rect.setAttribute('ry', y2);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        if (g.Style.stroke && g.Style.stroke.Draws === 'NO') {
            rect.setAttribute("style", `fill:${parseColor(g.Style.fill, 'none')};stroke:none;stroke-width:1`);
        } else {
            rect.setAttribute("style", `fill:${parseColor(g.Style.fill, 'none')};stroke:${parseColor(g.Style.stroke, 'black')};stroke-width:${getWidth(g.Style.stroke, 1)}`);
        }
        if (g.Style.stroke && g.Style.stroke.Pattern) {
            rect.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
        }
        //  <rect x="50" y="20" rx="20" ry="20" width="150" height="150"
        //   style="fill:red;stroke:black;stroke-width:5;opacity:0.5"/>
        if (g.Text.Text) {
            const text = document.createElementNS(svgNS, 'text');
            if (g.Text.TextAlongPathGlyphAnchor === 'center') {
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'middle');
                text.setAttribute('x', x1 + width / 2);
                text.setAttribute('y', y1 + height / 2);
            }

            text.textContent = getText(g.Text.Text);
            // <text x="0" y="15" fill="red">I love SVG</text>

            const gc = document.createElementNS(svgNS, 'g');
            gc.appendChild(rect);
            gc.appendChild(text);
            return gc;
        }

        return rect;
    }

    if (g.Class === "Group") {
        for (let j = 0; j < g.Graphics.length; j++) {
            const gi = g.Graphics[j];
            consnole.log(gi);
        }
        throw new Error('hehe');
        return;
    }

    if (g.Class === 'ShapedGraphic') {

    }
    //     Bounds: "{{0, 0}, {15, 22}}"
    // Class: "ShapedGraphic"
    // FitText: "YES"
    // Flow: "Resize"
    // ID: 2
    // Style: {fill: {…}, shadow: {…}, stroke: {…}}
    // Text: {TextAlongPathGlyphAnchor: "center"}
    // Wrap: "NO"

    console.log(g);
}

function renderGraphics(sheet) {
    const list = sheet.GraphicsList;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(svgNS, 'svg');
    const [boxWidth, boxHeight] = parsePoint(sheet.CanvasSize);
    const [originX, originY] = parsePoint(sheet.CanvasDimensionsOrigin);
    svgEl.setAttributeNS(null, "viewBox", `${originX} ${originY} ${boxWidth} ${boxHeight}`);
    svgEl.setAttributeNS(null, "width", boxWidth);
    svgEl.setAttributeNS(null, "height", boxHeight);

    for (let i = 0; i < list.length; i++) {
        const g = list[i];
        const element = renderGraphic(g);
        if (element) {
            svgEl.appendChild(element);
        }
        // svgEl.appendChild(pathEl);
    }
    return svgEl;
    // return $('div', '');
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
            if (graffle) {
                // TODO: Color Profiles
                // console.log(graffle);
                // console.log(icc.parse(graffle['ColorProfiles'][0].data));
                // Buffer.from(, 'base64').toString('utf8'));
                this.previewBox.appendChild($('div', `版面：${graffle['Sheets'].length}`));
                if (graffle['!Preview']) {
                    const img = new Image();
                    img.src = 'data:image/jpeg;base64,' + graffle['!Preview'].data.toString('base64');
                    const box = $('div', '');
                    box.appendChild(img);
                    this.previewBox.appendChild(box);
                } else {
                    const noPreview = document.createElement('div');
                    noPreview.innerText = "no preview";
                    this.previewBox.appendChild(noPreview);
                }
                for (let i = 0; i < graffle['Sheets'].length; i++) {
                    const sheet = graffle['Sheets'][i];
                    console.log(sheet);
                    this.previewBox.appendChild($('div', `${sheet.SheetTitle} 形状数量：${sheet.GraphicsList.length}`));
                    this.previewBox.appendChild(renderGraphics(sheet));
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
