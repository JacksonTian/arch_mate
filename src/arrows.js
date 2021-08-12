'use strict';

const svgNS = 'http://www.w3.org/2000/svg';

exports.createStickArrowHead = function () {
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'stick_arrow_head');
  // marker.setAttribute('viewBox', '0 0 20 20');
  marker.setAttribute('refX', 10);
  marker.setAttribute('refY', 6);
  // marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('markerWidth', 10);
  marker.setAttribute('markerHeight', 10);
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M2,2 L10,6 L2,10 L6,6 z');
  path.style.setProperty('fill', '#000000');
  marker.appendChild(path);
  return marker;
};

exports.createStickArrowTail = function () {
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'stick_arrow_tail');
  // marker.setAttribute('viewBox', '0 0 20 20');
  marker.setAttribute('refX', 2);
  marker.setAttribute('refY', 6);
  // marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('markerWidth', 10);
  marker.setAttribute('markerHeight', 10);
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M8,2 L0,6 L8,10 L4,6 z');
  path.style.setProperty('fill', '#000000');
  marker.appendChild(path);
  return marker;
};

exports.createArrowHead = function () {
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'arrow_head');
  // marker.setAttribute('viewBox', '0 0 20 20');
  marker.setAttribute('refX', 10);
  marker.setAttribute('refY', 6);
  // marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('markerWidth', 10);
  marker.setAttribute('markerHeight', 10);
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M2,2 L10,6 L2,10 L6,6 z');
  // path.style.setProperty('fill', '#000000');
  marker.appendChild(path);
  return marker;
};

exports.createArrowTail = function () {
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'arrow_tail');
  // marker.setAttribute('viewBox', '0 0 20 20');
  marker.setAttribute('refX', 2);
  marker.setAttribute('refY', 6);
  // marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('markerWidth', 10);
  marker.setAttribute('markerHeight', 10);
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M8,2 L0,6 L8,10 L4,6 z');
  // path.style.setProperty('fill', '#000000');
  marker.appendChild(path);
  return marker;
};

exports.createUMLInheritanceHead = function () {
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'uml_inheritance_head');
  // marker.setAttribute('viewBox', '0 0 20 20');
  marker.setAttribute('refX', 10);
  marker.setAttribute('refY', 6);
  // marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('markerWidth', 10);
  marker.setAttribute('markerHeight', 10);
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M2,2 L10,6 L2,10 L6,6 z');
  path.style.setProperty('fill', '#000000');
  marker.appendChild(path);
  return marker;
};

exports.createUMLInheritanceTail = function () {
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'uml_inheritance_tail');
  // marker.setAttribute('viewBox', '0 0 20 20');
  marker.setAttribute('refX', 2);
  marker.setAttribute('refY', 6);
  // marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('markerWidth', 10);
  marker.setAttribute('markerHeight', 10);
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M8,2 L0,6 L8,10 L4,6 z');
  path.style.setProperty('fill', '#000000');
  marker.appendChild(path);
  return marker;
};

exports.createFilledBallHead = function () {
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'filled_ball_head');
  // marker.setAttribute('viewBox', '0 0 20 20');
  marker.setAttribute('refX', 10);
  marker.setAttribute('refY', 6);
  // marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('markerWidth', 10);
  marker.setAttribute('markerHeight', 10);
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M2,2 L10,6 L2,10 L6,6 z');
  // path.style.setProperty('fill', '#000000');
  marker.appendChild(path);
  return marker;
};

exports.createFilledBallTail = function () {
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'filled_ball_tail');
  // marker.setAttribute('viewBox', '0 0 20 20');
  marker.setAttribute('refX', 2);
  marker.setAttribute('refY', 6);
  // marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('markerWidth', 10);
  marker.setAttribute('markerHeight', 10);
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M8,2 L0,6 L8,10 L4,6 z');
  // path.style.setProperty('fill', '#000000');
  marker.appendChild(path);
  return marker;
};

exports.mapping = {
  'StickArrow': 'stick_arrow',
  'Arrow': 'arrow',
  'UMLInheritance': 'uml_inheritance',
  'FilledBall': 'filled_ball'
};

exports.get = function (key) {
  if (!exports.mapping[key]) {
    throw new Error(`un-supported arrow type: ${key}`);
  }

  return exports.mapping[key];
};
