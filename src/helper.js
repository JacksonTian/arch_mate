'use strict';

function parsePoint(point) {
  const matched = point.match(/\{(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\}/);
  return [parseFloat(matched[1]), parseFloat(matched[2])];
}

function parseBounds(bounds) {
  const matched = bounds.match(/\{\{(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\},\s*\{(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\}\}/);
  return [parseFloat(matched[1]), parseFloat(matched[2]), parseFloat(matched[3]), parseFloat(matched[4])];
}

exports.parsePoint = parsePoint;
exports.parseBounds = parseBounds;
