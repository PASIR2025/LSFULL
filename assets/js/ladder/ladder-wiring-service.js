(function (global) {
  'use strict';

  const VERSION = '1.6.0-phase3';
  const EPSILON = 0.001;

  function kind(pin) {
    return String(pin && pin.kind || '').toLowerCase();
  }

  function isJunction(pin) {
    return kind(pin) === 'junction' || /^junction:/i.test(String(pin && pin.id || ''));
  }

  function sameElement(a, b) {
    if (!a || !b || isJunction(a) || isJunction(b)) return false;
    return !!a.elementId && a.elementId === b.elementId;
  }

  function sameUndirectedPair(wire, firstId, secondId) {
    if (!wire) return false;
    return (wire.from === firstId && wire.to === secondId) ||
      (wire.from === secondId && wire.to === firstId);
  }

  function hasDuplicate(wires, firstId, secondId) {
    return (wires || []).some(function (wire) {
      return sameUndirectedPair(wire, firstId, secondId);
    });
  }

  /**
   * Los terminales input/output describen la función lógica del componente,
   * no la dirección del conductor. El cable es una continuidad bidireccional.
   */
  function normalizeConnection(pinA, pinB, wires) {
    if (!pinA || !pinB) return { ok: false, reason: 'Selecciona dos terminales válidos.' };
    if (!pinA.id || !pinB.id) return { ok: false, reason: 'Los terminales no tienen identificador.' };
    if (pinA.id === pinB.id) return { ok: false, reason: 'No conectes un terminal consigo mismo.' };
    if (sameElement(pinA, pinB)) return { ok: false, reason: 'No conectes dos terminales del mismo componente directamente.' };
    if (hasDuplicate(wires, pinA.id, pinB.id)) return { ok: false, reason: 'Ese conductor ya existe.' };

    // Conserva una orientación canónica cuando existe una relación lógica clara,
    // pero nunca bloquea la continuidad física por la clase input/output.
    let from = pinA;
    let to = pinB;
    const aKind = kind(pinA);
    const bKind = kind(pinB);
    if (aKind === 'input' && bKind === 'output') { from = pinB; to = pinA; }
    else if (aKind === 'output' && bKind === 'junction') { from = pinA; to = pinB; }
    else if (aKind === 'junction' && bKind === 'output') { from = pinB; to = pinA; }
    else if (aKind === 'junction' && bKind === 'input') { from = pinA; to = pinB; }
    else if (aKind === 'input' && bKind === 'junction') { from = pinB; to = pinA; }

    return {
      ok: true,
      from: from,
      to: to,
      conductorDirection: 'bidirectional'
    };
  }

  function pushUnique(points, point) {
    if (!point) return;
    const previous = points[points.length - 1];
    if (previous && Math.abs(previous.x - point.x) < EPSILON && Math.abs(previous.y - point.y) < EPSILON) return;
    points.push({ x: point.x, y: point.y });
  }

  function compactOrthogonalPoints(points) {
    const clean = [];
    (points || []).forEach(function (value) {
      if (!value) return;
      const point = { x: Number(value.x), y: Number(value.y) };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      pushUnique(clean, point);
    });

    let changed = true;
    while (changed && clean.length > 2) {
      changed = false;
      for (let index = 1; index < clean.length - 1; index += 1) {
        const a = clean[index - 1];
        const b = clean[index];
        const c = clean[index + 1];
        const vertical = Math.abs(a.x - b.x) < EPSILON && Math.abs(b.x - c.x) < EPSILON;
        const horizontal = Math.abs(a.y - b.y) < EPSILON && Math.abs(b.y - c.y) < EPSILON;
        if (vertical || horizontal) {
          clean.splice(index, 1);
          changed = true;
          break;
        }
      }
    }
    return clean;
  }

  function orthogonalPoints(a, b, gap) {
    if (!a || !b) return [];
    const spacing = Math.max(8, Number(gap) || 36);
    const start = { x: Number(a.x) || 0, y: Number(a.y) || 0 };
    const end = { x: Number(b.x) || 0, y: Number(b.y) || 0 };
    const points = [];
    pushUnique(points, start);

    if (Math.abs(start.y - end.y) < EPSILON || Math.abs(start.x - end.x) < EPSILON) {
      pushUnique(points, end);
      return points;
    }

    const dx = end.x - start.x;
    if (Math.abs(dx) < spacing * 2) {
      const middleX = Math.round((start.x + end.x) / 2);
      pushUnique(points, { x: middleX, y: start.y });
      pushUnique(points, { x: middleX, y: end.y });
      pushUnique(points, end);
      return compactOrthogonalPoints(points);
    }

    const direction = dx >= 0 ? 1 : -1;
    const firstX = start.x + direction * spacing;
    const lastX = end.x - direction * spacing;
    pushUnique(points, { x: firstX, y: start.y });
    pushUnique(points, { x: firstX, y: end.y });
    pushUnique(points, { x: lastX, y: end.y });
    pushUnique(points, end);
    return compactOrthogonalPoints(points);
  }

  function nearestPointOnSegment(x, y, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) {
      return { x: a.x, y: a.y, t: 0, distance: Math.hypot(x - a.x, y - a.y) };
    }
    let t = ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    return { x: px, y: py, t: t, distance: Math.hypot(x - px, y - py) };
  }

  function nearestPointOnPolyline(x, y, points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    let best = null;
    for (let index = 0; index < points.length - 1; index += 1) {
      const result = nearestPointOnSegment(x, y, points[index], points[index + 1]);
      if (!best || result.distance < best.distance) {
        best = {
          x: result.x,
          y: result.y,
          t: result.t,
          distance: result.distance,
          segmentIndex: index,
          orientation: Math.abs(points[index].y - points[index + 1].y) < EPSILON ? 'horizontal' : 'vertical'
        };
      }
    }
    return best;
  }

  function splitPolylineAt(points, segmentIndex, point) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const index = Math.max(0, Math.min(points.length - 2, Number(segmentIndex) || 0));
    const exact = { x: Number(point.x), y: Number(point.y) };
    if (!Number.isFinite(exact.x) || !Number.isFinite(exact.y)) return null;
    const first = compactOrthogonalPoints(points.slice(0, index + 1).concat([exact]));
    const second = compactOrthogonalPoints([exact].concat(points.slice(index + 1)));
    return { first: first, second: second, point: exact };
  }

  function getJunctionDegree(junctionId, wires) {
    return (wires || []).reduce(function (total, wire) {
      return total + (wire && (wire.from === junctionId || wire.to === junctionId) ? 1 : 0);
    }, 0);
  }

  function findNearestPin(pins, x, y, radius) {
    const maximum = Math.max(8, Number(radius) || 28);
    let best = null;
    (pins || []).forEach(function (pin) {
      if (!pin) return;
      const distance = Math.hypot(x - pin.x, y - pin.y);
      const accepted = Math.max(maximum, Number(pin.r || 0) + 14);
      if (distance > accepted) return;
      if (!best || distance < best.distance) best = { pin: pin, distance: distance };
    });
    return best ? best.pin : null;
  }

  function createNodeRecord(id, pin) {
    return {
      id: id,
      kind: pin && pin.kind || (/^junction:/i.test(id) ? 'junction' : 'terminal'),
      pin: pin || null,
      connectedWireIds: [],
      neighborIds: []
    };
  }

  /**
   * Grafo de continuidad: terminales/uniones = nodos, cables = aristas no dirigidas.
   * Las relaciones internas de los componentes se evalúan fuera de este grafo.
   */
  function buildElectricalGraph(options) {
    const settings = options || {};
    const pins = settings.pins || [];
    const wires = settings.wires || [];
    const junctions = settings.junctions || [];
    const nodes = new Map();
    const edges = new Map();
    const adjacency = new Map();

    function ensureNode(id, pin) {
      const key = String(id || '');
      if (!key) return null;
      if (!nodes.has(key)) nodes.set(key, createNodeRecord(key, pin));
      else if (pin && !nodes.get(key).pin) nodes.get(key).pin = pin;
      if (!adjacency.has(key)) adjacency.set(key, new Set());
      return nodes.get(key);
    }

    pins.forEach(function (pin) { if (pin && pin.id) ensureNode(pin.id, pin); });
    junctions.forEach(function (junction) {
      if (!junction || !junction.id) return;
      ensureNode(junction.id, {
        id: junction.id,
        kind: 'junction',
        junction: true,
        x: junction.x,
        y: junction.y
      });
    });

    wires.forEach(function (wire) {
      if (!wire || !wire.id || !wire.from || !wire.to) return;
      const from = ensureNode(wire.from, null);
      const to = ensureNode(wire.to, null);
      if (!from || !to) return;
      const edge = { id: wire.id, from: wire.from, to: wire.to, wire: wire };
      edges.set(edge.id, edge);
      adjacency.get(edge.from).add(edge.to);
      adjacency.get(edge.to).add(edge.from);
      from.connectedWireIds.push(edge.id);
      to.connectedWireIds.push(edge.id);
      if (from.neighborIds.indexOf(edge.to) < 0) from.neighborIds.push(edge.to);
      if (to.neighborIds.indexOf(edge.from) < 0) to.neighborIds.push(edge.from);
    });

    const networks = [];
    const nodeToNetwork = new Map();
    let networkCounter = 1;
    nodes.forEach(function (_node, nodeId) {
      if (nodeToNetwork.has(nodeId)) return;
      const networkId = 'network_' + networkCounter++;
      const queue = [nodeId];
      const nodeIds = [];
      const wireIds = new Set();
      nodeToNetwork.set(nodeId, networkId);
      while (queue.length) {
        const current = queue.shift();
        nodeIds.push(current);
        const record = nodes.get(current);
        (record && record.connectedWireIds || []).forEach(function (wireId) { wireIds.add(wireId); });
        (adjacency.get(current) || []).forEach(function (neighbor) {
          if (nodeToNetwork.has(neighbor)) return;
          nodeToNetwork.set(neighbor, networkId);
          queue.push(neighbor);
        });
      }
      networks.push({ id: networkId, nodeIds: nodeIds, wireIds: Array.from(wireIds), energized: false });
    });

    const networkById = new Map(networks.map(function (network) { return [network.id, network]; }));
    return { nodes: nodes, edges: edges, adjacency: adjacency, networks: networks, nodeToNetwork: nodeToNetwork, networkById: networkById };
  }

  function floodElectricalGraph(graph, seedNodeIds) {
    const energizedNodes = new Set();
    const energizedNetworks = new Set();
    const queue = [];
    (seedNodeIds || []).forEach(function (id) {
      const key = String(id || '');
      if (!key || energizedNodes.has(key)) return;
      energizedNodes.add(key);
      queue.push(key);
    });

    while (queue.length) {
      const current = queue.shift();
      const networkId = graph && graph.nodeToNetwork && graph.nodeToNetwork.get(current);
      if (networkId) energizedNetworks.add(networkId);
      const neighbors = graph && graph.adjacency && graph.adjacency.get(current);
      (neighbors || []).forEach(function (neighbor) {
        if (energizedNodes.has(neighbor)) return;
        energizedNodes.add(neighbor);
        queue.push(neighbor);
      });
    }

    const energizedWires = new Set();
    if (graph && graph.edges) {
      graph.edges.forEach(function (edge, wireId) {
        if (energizedNodes.has(edge.from) || energizedNodes.has(edge.to)) energizedWires.add(wireId);
      });
    }
    if (graph && graph.networks) {
      graph.networks.forEach(function (network) { network.energized = energizedNetworks.has(network.id); });
    }
    return { nodeIds: energizedNodes, wireIds: energizedWires, networkIds: energizedNetworks };
  }

  function updateJunctionMetadata(graph, junctions, wires) {
    const wireMap = new Map((wires || []).filter(Boolean).map(function (wire) { return [wire.id, wire]; }));
    (junctions || []).forEach(function (junction) {
      if (!junction || !junction.id) return;
      const record = graph && graph.nodes && graph.nodes.get(junction.id);
      const connectedWireIds = record ? record.connectedWireIds.slice() : [];
      const connectedTerminalIds = [];
      connectedWireIds.forEach(function (wireId) {
        const wire = wireMap.get(wireId);
        if (!wire) return;
        const other = wire.from === junction.id ? wire.to : wire.from;
        if (other && !/^junction:/i.test(String(other)) && connectedTerminalIds.indexOf(other) < 0) connectedTerminalIds.push(other);
      });
      junction.type = 'junction';
      junction.connectedWireIds = connectedWireIds;
      junction.connectedTerminalIds = connectedTerminalIds;
      junction.networkId = graph && graph.nodeToNetwork ? (graph.nodeToNetwork.get(junction.id) || null) : null;
      junction.energized = !!(junction.networkId && graph.networkById && graph.networkById.get(junction.networkId) && graph.networkById.get(junction.networkId).energized);
    });
  }

  global.SimuPLCLadderWiring = Object.freeze({
    version: VERSION,
    normalizeConnection: normalizeConnection,
    orthogonalPoints: orthogonalPoints,
    compactOrthogonalPoints: compactOrthogonalPoints,
    nearestPointOnSegment: nearestPointOnSegment,
    nearestPointOnPolyline: nearestPointOnPolyline,
    splitPolylineAt: splitPolylineAt,
    getJunctionDegree: getJunctionDegree,
    findNearestPin: findNearestPin,
    isJunction: isJunction,
    sameUndirectedPair: sameUndirectedPair,
    buildElectricalGraph: buildElectricalGraph,
    floodElectricalGraph: floodElectricalGraph,
    updateJunctionMetadata: updateJunctionMetadata
  });
})(window);
