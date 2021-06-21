'use strict';

function parsePoint(point) {
  const matched = point.match(/\{(-?\d+\.?\d*e?-?\d*),\s*(-?\d+\.?\d*e?-?\d*)\}/);
  return [parseFloat(matched[1]), parseFloat(matched[2])];
}

function parseBounds(bounds) {
  const matched = bounds.match(/\{\{(-?\d+\.?\d*e?-?\d*),\s*(-?\d+\.?\d*)\},\s*\{(-?\d+\.?\d*),\s*(-?\d+\.?\d*e?-?\d*)\}\}/);
  return [parseFloat(matched[1]), parseFloat(matched[2]), parseFloat(matched[3]), parseFloat(matched[4])];
}

exports.getLogicalPath = function (path) {
  let data = '';
  for (let i = 0; i < path.elements.length; i++) {
    const d = path.elements[i];

    if (i > 0) {
      data += ' ';
    }
    switch (d.element) {
    case 'MOVETO': {
      let [x, y] = parsePoint(d.point);
      data += `M${x} ${y}`;
    }
      break;
    case 'LINETO': {
      let [x, y] = parsePoint(d.point);
      data += `L${x} ${y}`;
    }
      break;
    case 'CURVETO': {
      let [x, y] = parsePoint(d.point);
      let [c1x, c1y] = parsePoint(d.control1);
      let [c2x, c2y] = parsePoint(d.control2);
      data += `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x} ${y}`;
    }
      break;
    case 'CLOSE': {
      data += `Z`;
    }
      break;
    default:
      throw new Error(`Un-supported element: ${d.element}`);
    }
    // console.log(d);0: {element: "MOVETO", point: "{451.5, 132.5}"}
    // 1: {control1: "{451.5, 132.5}", control2: "{496.91744145677217, 37.80016998053074}", element: "CURVETO", point: "{588, 39.5}"}
    // 2: {control1: "{679.08255854322783, 41.19983001946926}", control2: "{773, 138.5}", element: "CURVETO", point: "{773, 138.5}"}
  }
  return data;
};

exports.getPath =  function (points) {
  const [p1, ...ps] = points;
  const [x1, y1] = parsePoint(p1);
  let data = `M${x1} ${y1}`;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const [x, y] = parsePoint(p);
    data += `L${x} ${y}`;
  }
  return data;
};

exports.parsePoint = parsePoint;
exports.parseBounds = parseBounds;
