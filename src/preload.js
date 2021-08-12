'use strict';

const { ipcRenderer, shell } = require('electron');
const path = require('path');
const { readdir, stat, readFile } = require('fs').promises;
const { unzip } = require('zlib');

const StreamZip = require('node-stream-zip');
// const icc = require('icc');
const iconv = require('iconv-lite');
const rtf = require('@jacksontian/rtf-parser');

const helper = require('./helper');
const { Controller } = require('./ui');

const arrows = require('./arrows');

const svgNS = 'http://www.w3.org/2000/svg';

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
  }
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

const colorMap = {
  'systemRedColor': 'red'
};

const pattern = {
  '1': '5,5',
  '2': '1,4',
  '5': '3,4'
};

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
    return colorMap[c.name];
  }

  // if (c.space !== 'srgb') {
  if (c.space !== '') {
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

function wrapText(item, text, x, y, width, height) {
  const t = document.createElementNS(svgNS, 'text');
  // if (g.Text.TextAlongPathGlyphAnchor === 'center') {
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('dominant-baseline', 'middle');
  t.setAttribute('x', x + width / 2);
  t.setAttribute('y', y + height / 2);
  // }

  t.textContent = getText(text);
  // <text x="0" y="15" fill="red">I love SVG</text>
  const gc = document.createElementNS(svgNS, 'g');
  gc.appendChild(item);
  gc.appendChild(t);
  return gc;
}

function createDefs() {
  const defs = document.createElementNS(svgNS, 'defs');
  defs.appendChild(arrows.createStickArrowHead());
  defs.appendChild(arrows.createStickArrowTail());
  defs.appendChild(arrows.createArrowHead());
  defs.appendChild(arrows.createArrowTail());
  defs.appendChild(arrows.createUMLInheritanceHead());
  defs.appendChild(arrows.createUMLInheritanceTail());
  defs.appendChild(arrows.createFilledBallHead());
  defs.appendChild(arrows.createFilledBallTail());
  return defs;
}

function renderLineGraphic(g) {
  const path = document.createElementNS(svgNS, 'path');
  // <path d="M 175 200 l 150 0" stroke="green" stroke-width="3" fill="none" />
  if (g.LogicalPath) {
    path.setAttribute('d', helper.getLogicalPath(g.LogicalPath));
  } else {
    path.setAttribute('d', helper.getPath(g.Points));
  }

  path.setAttribute('style', `stroke:${parseColor(g.Style.stroke, 'black')};stroke-width:1`);
  if (g.Style.fill?.Draws === 'NO') {
    path.setAttribute('fill', 'none');
  } else {
    path.setAttribute('fill', parseColor(g.Style?.fill, 'none'));
  }

  if (g.Style.stroke?.HeadArrow) {
    path.setAttribute('marker-end', `url(#${arrows.get(g.Style.stroke?.HeadArrow)}_head)`);
  }

  if (g.Style.stroke?.TailArrow) {
    path.setAttribute('marker-start', `url(#${arrows.get(g.Style.stroke?.TailArrow)}_tail)`);
  }

  if (g.Style.stroke.Pattern) {
    path.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
  }
  // <line x1="0" y1="0" x2="200" y2="200" style="stroke:rgb(255,0,0);stroke-width:2"/>
  return path;
}

function renderCircle(g) {
  //         <ellipse cx="300" cy="80" rx="100" ry="50"
  //   style="fill:yellow;stroke:purple;stroke-width:2"/>
  const ellipse = document.createElementNS(svgNS, 'ellipse');
  const [x1, y1, width, height] = helper.parseBounds(g.Bounds);
  ellipse.setAttribute('cx', x1 + width / 2);
  ellipse.setAttribute('cy', y1 + height / 2);
  ellipse.setAttribute('rx', width / 2);
  ellipse.setAttribute('ry', height / 2);
  if (g.Style.stroke && g.Style.stroke.Draws === 'NO') {
    ellipse.setAttribute('style', `fill:${parseColor(g.Style.fill, 'none')};stroke:none;stroke-width:1`);
  } else {
    ellipse.setAttribute('style', `fill:${parseColor(g.Style.fill, 'none')};stroke:${parseColor(g.Style.stroke, 'black')};stroke-width:${getWidth(g.Style.stroke, 1)}`);
  }
  // if (g.Style.stroke && g.Style.stroke.Pattern) {
  //     rect.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
  // }

  if (g.Text?.Text) {
    return wrapText(ellipse, g.Text?.Text, x1, y1, width, height);
  }

  return ellipse;
}

function renderDiamond(g) {
  const polygon = document.createElementNS(svgNS, 'polygon');
  const [x, y, width, height] = helper.parseBounds(g.Bounds);
  const p1 = [x + width / 2, y].join(',');
  const p2 = [x + width, y + height / 2].join(',');
  const p3 = [x + width / 2, y + height].join(',');
  const p4 = [x, y + height / 2].join(',');
  polygon.setAttribute('points', [p1, p2, p3, p4].join(' '));
  //   <polygon points="200,10 250,190 160,210"
  // style="fill:lime;stroke:purple;stroke-width:1"/>
  if (g.Style?.stroke?.Draws === 'NO') {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
  } else {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
  }
  if (g.Style?.stroke?.Pattern) {
    polygon.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
  }

  if (g.Text?.Text) {
    return wrapText(polygon, g.Text?.Text, x, y, width, height);
  }

  return polygon;
}

function renderVerticalTriangle(g) {
  const polygon = document.createElementNS(svgNS, 'polygon');
  const [x, y, width, height] = helper.parseBounds(g.Bounds);
  const p1 = [x, y].join(',');
  const p2 = [x + width, y].join(',');
  const p3 = [x + width / 2, y + height].join(',');
  polygon.setAttribute('points', [p1, p2, p3].join(' '));
  //   <polygon points="200,10 250,190 160,210"
  // style="fill:lime;stroke:purple;stroke-width:1"/>
  if (g.Style?.stroke?.Draws === 'NO') {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
  } else {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
  }
  if (g.Style?.stroke?.Pattern) {
    polygon.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
  }

  if (g.VFlip === 'YES') {
    const [cx, cy] = [x + width/2, y + height / 2];
    polygon.setAttribute('transform', `rotate(180, ${cx} ${cy})`);
  }

  if (g.Text?.Text) {
    return wrapText(polygon, g.Text?.Text, x, y, width, height);
  }

  return polygon;
}

function renderHorizontalTriangle(g) {
  const polygon = document.createElementNS(svgNS, 'polygon');
  const [x, y, width, height] = helper.parseBounds(g.Bounds);
  const p1 = [x, y].join(',');
  const p2 = [x + width, y + height / 2].join(',');
  const p3 = [x, y + height].join(',');
  polygon.setAttribute('points', [p1, p2, p3].join(' '));
  //   <polygon points="200,10 250,190 160,210"
  // style="fill:lime;stroke:purple;stroke-width:1"/>
  if (g.Style?.stroke?.Draws === 'NO') {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
  } else {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
  }
  if (g.Style?.stroke?.Pattern) {
    polygon.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
  }

  if (g.VFlip === 'YES') {
    const [cx, cy] = [x + width/2, y + height / 2];
    polygon.setAttribute('transform', `rotate(180, ${cx} ${cy})`);
  }

  if (g.Text?.Text) {
    return wrapText(polygon, g.Text?.Text, x, y, width, height);
  }

  return polygon;
}

function renderRightTriangle(g) {
  const polygon = document.createElementNS(svgNS, 'polygon');
  const [x, y, width, height] = helper.parseBounds(g.Bounds);
  const p1 = [x, y].join(',');
  const p2 = [x + width, y + height].join(',');
  const p3 = [x, y + height].join(',');
  polygon.setAttribute('points', [p1, p2, p3].join(' '));
  //   <polygon points="200,10 250,190 160,210"
  // style="fill:lime;stroke:purple;stroke-width:1"/>
  if (g.Style?.stroke?.Draws === 'NO') {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
  } else {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
  }
  if (g.Style?.stroke?.Pattern) {
    polygon.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
  }

  if (g.VFlip === 'YES') {
    const [cx, cy] = [x + width/2, y + height / 2];
    polygon.setAttribute('transform', `rotate(180, ${cx} ${cy})`);
  }

  if (g.Text?.Text) {
    return wrapText(polygon, g.Text?.Text, x, y, width, height);
  }

  return polygon;
}

function renderPentagon(g) {
  const polygon = document.createElementNS(svgNS, 'polygon');
  const [x, y, width, height] = helper.parseBounds(g.Bounds);
  const p1 = [x + width / 2, y].join(',');
  const p2 = [x + width, y + height / 5 * 2].join(',');
  const p3 = [x + width / 5 * 4, y + height].join(',');
  const p4 = [x + width / 5, y + height].join(',');
  const p5 = [x, y + height / 5 * 2].join(',');
  polygon.setAttribute('points', [p1, p2, p3, p4, p5].join(' '));
  //   <polygon points="200,10 250,190 160,210"
  // style="fill:lime;stroke:purple;stroke-width:1"/>
  if (g.Style?.stroke?.Draws === 'NO') {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
  } else {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
  }
  if (g.Style?.stroke?.Pattern) {
    polygon.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
  }

  if (g.VFlip === 'YES') {
    const [cx, cy] = [x + width/2, y + height / 2];
    polygon.setAttribute('transform', `rotate(180, ${cx} ${cy})`);
  }

  if (g.Text?.Text) {
    return wrapText(polygon, g.Text?.Text, x, y, width, height);
  }

  return polygon;
}

function renderOctagon(g) {
  const polygon = document.createElementNS(svgNS, 'polygon');
  const [x, y, width, height] = helper.parseBounds(g.Bounds);
  const p1 = [x + width / 3 * 2, y].join(',');
  const p2 = [x + width, y + height / 3].join(',');
  const p3 = [x + width, y + height / 3 * 2].join(',');
  const p4 = [x + width / 3 * 2, y + height].join(',');
  const p5 = [x + width / 3, y + height].join(',');
  const p6 = [x, y + height / 3 * 2].join(',');
  const p7 = [x, y + height / 3].join(',');
  const p8 = [x + width / 3, y].join(',');
  polygon.setAttribute('points', [p1, p2, p3, p4, p5, p6, p7, p8].join(' '));
  //   <polygon points="200,10 250,190 160,210"
  // style="fill:lime;stroke:purple;stroke-width:1"/>
  if (g.Style?.stroke?.Draws === 'NO') {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
  } else {
    polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
  }
  if (g.Style?.stroke?.Pattern) {
    polygon.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
  }

  if (g.VFlip === 'YES') {
    const [cx, cy] = [x + width/2, y + height / 2];
    polygon.setAttribute('transform', `rotate(180, ${cx} ${cy})`);
  }

  if (g.Text?.Text) {
    return wrapText(polygon, g.Text?.Text, x, y, width, height);
  }

  return polygon;
}

function renderGraphic(g, sheet) {
  if (g.Class === 'LineGraphic') {
    return renderLineGraphic(g);
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'Circle') {
    return renderCircle(g);
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'Diamond') {
    return renderDiamond(g);
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'VerticalTriangle') {
    return renderVerticalTriangle(g);
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'HorizontalTriangle') {
    return renderHorizontalTriangle(g);
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'RightTriangle') {
    return renderRightTriangle(g);
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'Pentagon') {
    return renderPentagon(g);
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'Octagon') {
    return renderOctagon(g);
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'AdjustableArrow') {
    const {ratio, width: wd} = g.ShapeData;
    const polygon = document.createElementNS(svgNS, 'polygon');
    const [x, y, width, height] = helper.parseBounds(g.Bounds);
    const p1 = [x, y + height * (1 - ratio) / 2].join(',');
    const p2 = [x + width - wd, y + height * (1 - ratio) / 2].join(',');
    const p3 = [x + width - wd, y].join(',');
    const p4 = [x + width, y + height / 2].join(',');
    const p5 = [x + width - wd, y + height].join(',');
    const p6 = [x + width - wd, y + height * (1 - (1 - ratio) / 2)].join(',');
    const p7 = [x, y + height * (1 - (1 - ratio) / 2)].join(',');

    polygon.setAttribute('points', [p1, p2, p3, p4, p5, p6, p7].join(' '));
    if (g.Style?.stroke?.Draws === 'NO') {
      polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
    } else {
      polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
    }
    if (g.Style?.stroke?.Pattern) {
      polygon.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
    }
  
    if (g.VFlip === 'YES') {
      const [cx, cy] = [x + width/2, y + height / 2];
      polygon.setAttribute('transform', `rotate(180, ${cx} ${cy})`);
    }
  
    if (g.Text?.Text) {
      return wrapText(polygon, g.Text?.Text, x, y, width, height);
    }
  
    return polygon;
  }

  if (g.Class === 'ShapedGraphic' && g.Shape === 'AdjustableDoubleArrow') {
    const {width: wd} = g.ShapeData;
    const ratio = g.ShapeData.ratio || 0.5;
    const polygon = document.createElementNS(svgNS, 'polygon');
    const [x, y, width, height] = helper.parseBounds(g.Bounds);
    const p1 = [x, y + height / 2].join(',');
    const p2 = [x + wd, y].join(',');
    const p3 = [x + wd, y + height * (1 - ratio) / 2].join(',');
    const p4 = [x + width - wd, y + height * (1 - ratio) / 2].join(',');
    const p5 = [x + width - wd, y].join(',');
    const p6 = [x + width, y + height / 2].join(',');
    const p7 = [x + width - wd, y + height].join(',');
    const p8 = [x + width - wd, y + height * (1 - (1 - ratio) / 2)].join(',');
    const p9 = [x + wd, y + height * (1 - (1 - ratio) / 2)].join(',');
    const p10 = [x + wd, y + height].join(',');

    polygon.setAttribute('points', [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10].join(' '));
    if (g.Style?.stroke?.Draws === 'NO') {
      polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
    } else {
      polygon.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
    }
    if (g.Style?.stroke?.Pattern) {
      polygon.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
    }
  
    if (g.VFlip === 'YES') {
      const [cx, cy] = [x + width/2, y + height / 2];
      polygon.setAttribute('transform', `rotate(180, ${cx} ${cy})`);
    }
  
    if (g.Text?.Text) {
      return wrapText(polygon, g.Text?.Text, x, y, width, height);
    }
  
    return polygon;
  }

  // exported shape
  if (g.Class === 'ShapedGraphic' && g.Shape?.length === 59) {
    const sharpId = g.Shape;
    const s = sheet.ExportShapes.find((d) => d.ShapeName === sharpId);
    const path = document.createElementNS(svgNS, 'path');
    // <path d="M 175 200 l 150 0" stroke="green" stroke-width="3" fill="none" />
    path.setAttribute('d', helper.getLogicalPath(s.StrokePath));
    if (g.Style?.stroke?.Draws === 'NO') {
      path.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
    } else {
      path.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
    }

    const rect = document.createElementNS(svgNS, 'rect');
    const [x1, y1, width, height] = helper.parseBounds(g.Bounds);
    rect.setAttribute('x', x1);
    rect.setAttribute('y', y1);
    // 圆角
    const r = g.Style?.stroke?.CornerRadius || 0;
    rect.setAttribute('rx', r);
    rect.setAttribute('ry', r);

    rect.setAttribute('width', width);
    rect.setAttribute('height', height);

    const box = document.createElementNS(svgNS, 'g');

    box.appendChild(path);
    box.appendChild(rect);
    return box;
  }

  if (g.Class === 'ShapedGraphic' && !g.Shape) {
    const rect = document.createElementNS(svgNS, 'rect');
    const [x1, y1, width, height] = helper.parseBounds(g.Bounds);
    rect.setAttribute('x', x1);
    rect.setAttribute('y', y1);
    // 圆角
    const r = g.Style?.stroke?.CornerRadius || 0;
    rect.setAttribute('rx', r);
    rect.setAttribute('ry', r);

    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    if (g.Style?.stroke?.Draws === 'NO') {
      rect.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:none;stroke-width:1`);
    } else {
      rect.setAttribute('style', `fill:${parseColor(g.Style?.fill, 'none')};stroke:${parseColor(g.Style?.stroke, 'black')};stroke-width:${getWidth(g.Style?.stroke, 1)}`);
    }
    if (g.Style?.stroke?.Pattern) {
      rect.setAttribute('stroke-dasharray', pattern[g.Style.stroke.Pattern]);
    }
    //  <rect x="50" y="20" rx="20" ry="20" width="150" height="150"
    //   style="fill:red;stroke:black;stroke-width:5;opacity:0.5"/>
    if (g.Text?.Text) {
      return wrapText(rect, g.Text?.Text, x1, y1, width, height);
    }

    return rect;
  }

  if (g.Class === 'Group') {
    const gg = document.createElementNS(svgNS, 'g');
    for (let j = 0; j < g.Graphics.length; j++) {
      const gi = g.Graphics[j];
      gg.appendChild(renderGraphic(gi));
    }
    return gg;
  }

  throw new Error('un-supported graphic');
}

function renderGraphics(sheet) {
  const list = sheet.GraphicsList;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svgEl = document.createElementNS(svgNS, 'svg');
  const [originX, originY] = sheet.CanvasDimensionsOrigin ? helper.parsePoint(sheet.CanvasDimensionsOrigin) : [0, 0];
  const [boxWidth, boxHeight] = sheet.CanvasSize ? helper.parsePoint(sheet.CanvasSize) : [500, 500];
  svgEl.setAttributeNS(null, 'width', boxWidth);
  svgEl.setAttributeNS(null, 'height', boxHeight);
  svgEl.setAttributeNS(null, 'viewBox', `${originX} ${originY} ${boxWidth} ${boxHeight}`);

  svgEl.appendChild(createDefs());

  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    const element = renderGraphic(g, sheet);
    if (element) {
      svgEl.appendChild(element);
    }
    // svgEl.appendChild(pathEl);
  }
  return svgEl;
  // return $('div', '');
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
    delegate(this.listElement, 'click', 'item', this._onClick.bind(this));
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
    delegate(this.element, 'dblclick', 'preview', this._onDBClick.bind(this));
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
          noPreview.innerText = 'no preview';
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

async function render() {
  const controller = new Controller();

  const projectDir = await ipcRenderer.invoke('get_project_dir');
  if (projectDir) {
    document.title = projectDir;
  }

  const rootView = new RootView(controller);
  const splitWidget = new SplitWidget(controller);
  const sideWidget = new ListWidget(controller);

  if (projectDir) {
    await renderList(sideWidget, projectDir);
  }

  splitWidget.setSideWidget(sideWidget);
  const mainWidget = new MainWidget(controller);
  splitWidget.setMainWidget(mainWidget);

  rootView.setWidget(splitWidget);
  rootView.attachToDocument(document.body);
}

window.addEventListener('DOMContentLoaded', render);
