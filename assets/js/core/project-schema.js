(function (global) {
  'use strict';

  if (global.SimuPLCProjectSchema) return;

  const MAX_FBD_NODES = 20000;
  const MAX_FBD_CONNECTIONS = 50000;
  const MAX_LADDER_RUNGS = 5000;
  const MAX_LADDER_ELEMENTS = 30000;
  const MAX_LADDER_WIRES = 60000;
  const MAX_LADDER_JUNCTIONS = 30000;

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function emptyFBD() {
    return {
      type: 'simuplc-fbd',
      version: 4,
      savedAt: new Date().toISOString(),
      nodes: [],
      connections: [],
      freeTexts: [],
      settings: { counts: {}, view: {} }
    };
  }

  function emptyLadder() {
    return {
      type: 'ladder-phase9',
      version: 1,
      rungs: [{ id: 'r1', elements: [] }],
      proWires: [],
      proJunctions: [],
      referenceTexts: [],
      settings: {}
    };
  }

  function normalizeFBD(value) {
    value = clone(value || {});
    if (value.editors && value.editors.fbd) value = value.editors.fbd;
    if (value.fbd && !value.nodes) value = value.fbd;
    if (value.data && Array.isArray(value.data.nodes)) value = value.data;
    if (!isObject(value)) value = {};
    if (!Array.isArray(value.nodes)) value.nodes = [];
    if (!Array.isArray(value.connections)) {
      value.connections = Array.isArray(value.wires) ? value.wires : [];
    }
    if (!Array.isArray(value.freeTexts)) {
      value.freeTexts = Array.isArray(value.annotations) ? value.annotations : (Array.isArray(value.texts) ? value.texts : []);
    }
    value.type = value.type || 'simuplc-fbd';
    value.version = Number(value.version || value.v || 4) || 4;
    value.settings = isObject(value.settings) ? value.settings : {};
    return value;
  }

  function normalizeLadder(value) {
    value = clone(value || {});
    if (value.editors && value.editors.ladder) value = value.editors.ladder;
    if (value.ladder && !value.rungs) value = value.ladder;
    if (value.data && Array.isArray(value.data.rungs)) value = value.data;
    if (!isObject(value)) value = {};
    if (!Array.isArray(value.rungs)) value.rungs = emptyLadder().rungs;
    value.rungs = value.rungs.map(function (rung, index) {
      if (!isObject(rung)) return { id: 'r' + (index + 1), elements: [] };
      if (!Array.isArray(rung.elements)) rung.elements = [];
      if (!rung.id) rung.id = 'r' + (index + 1);
      return rung;
    });
    if (!value.rungs.length) value.rungs = emptyLadder().rungs;
    if (!Array.isArray(value.proWires)) value.proWires = [];
    if (!Array.isArray(value.proJunctions)) value.proJunctions = [];
    if (!Array.isArray(value.referenceTexts)) {
      value.referenceTexts = Array.isArray(value.annotations) ? value.annotations : (Array.isArray(value.texts) ? value.texts : []);
    }
    value.type = value.type || 'ladder-phase9';
    value.version = Number(value.version || 1) || 1;
    value.settings = isObject(value.settings) ? value.settings : {};
    return value;
  }

  function createProject(options) {
    options = options || {};
    const config = global.SimuPLCConfig || {
      appName: 'SimuPLC Lab', appVersion: 'desconocida',
      projectType: 'simuplc-project', projectSchemaVersion: 1
    };
    const now = new Date().toISOString();

    return {
      type: config.projectType,
      schemaVersion: config.projectSchemaVersion,
      version: config.projectSchemaVersion,
      app: { name: config.appName, version: config.appVersion },
      name: String(options.name || 'Proyecto SimuPLC'),
      createdAt: options.createdAt || options.savedAt || now,
      updatedAt: now,
      savedAt: now,
      activeEditor: options.activeEditor === 'ladder' ? 'ladder' : 'fbd',
      editors: {
        fbd: normalizeFBD(options.fbd || emptyFBD()),
        ladder: normalizeLadder(options.ladder || emptyLadder())
      },
      hardware: isObject(options.hardware) ? clone(options.hardware) : {}
    };
  }

  function assertCompatibleVersion(source) {
    const config = global.SimuPLCConfig || { projectSchemaVersion: 1, projectType: 'simuplc-project' };
    if (!source || source.type !== config.projectType) return;
    const incoming = Number(source.schemaVersion || source.version || 1) || 1;
    const supported = Number(config.projectSchemaVersion || 1) || 1;
    if (incoming > supported) {
      throw new Error('El proyecto usa la versión ' + incoming + ', pero esta aplicación admite hasta la versión ' + supported + '. Actualiza SimuPLC Lab para abrirlo.');
    }
  }

  function migrate(input, fallbacks) {
    const config = global.SimuPLCConfig || {};
    const source = clone(input || {});
    fallbacks = fallbacks || {};
    assertCompatibleVersion(source);

    if (source.type === config.projectType && source.editors) {
      return createProject({
        name: source.name,
        createdAt: source.createdAt || source.savedAt,
        activeEditor: source.activeEditor,
        fbd: source.editors.fbd,
        ladder: source.editors.ladder,
        hardware: source.hardware || source.mcuConfig
      });
    }

    if (source.editors || source.fbd || source.ladder || source.type === config.legacyDualProjectType) {
      return createProject({
        name: source.name,
        createdAt: source.createdAt || source.savedAt,
        activeEditor: source.activeEditor,
        fbd: (source.editors && source.editors.fbd) || source.fbd || fallbacks.fbd,
        ladder: (source.editors && source.editors.ladder) || source.ladder || fallbacks.ladder,
        hardware: source.hardware || source.mcuConfig || fallbacks.hardware
      });
    }

    if (Array.isArray(source.nodes) || (source.data && Array.isArray(source.data.nodes))) {
      return createProject({
        name: source.name || 'Proyecto FBD importado',
        activeEditor: 'fbd',
        fbd: source.data && Array.isArray(source.data.nodes) ? source.data : source,
        ladder: fallbacks.ladder,
        hardware: source.hardware || source.mcuConfig || fallbacks.hardware
      });
    }

    if (Array.isArray(source.rungs) || source.type === 'ladder-phase9' || source.type === 'ladder-free-pro-industrial') {
      return createProject({
        name: source.name || 'Proyecto Ladder importado',
        activeEditor: 'ladder',
        fbd: fallbacks.fbd,
        ladder: source,
        hardware: source.hardware || source.mcuConfig || fallbacks.hardware
      });
    }

    throw new Error('El archivo no contiene un proyecto SimuPLC reconocido.');
  }

  function validateFBD(fbd, errors, warnings, strict) {
    if (!isObject(fbd)) {
      errors.push('La sección FBD no es válida.');
      return;
    }
    if (!Array.isArray(fbd.nodes)) errors.push('FBD no contiene una lista nodes válida.');
    if (!Array.isArray(fbd.connections)) errors.push('FBD no contiene una lista connections válida.');
    if (Array.isArray(fbd.nodes) && fbd.nodes.length > MAX_FBD_NODES) errors.push('FBD supera el límite seguro de ' + MAX_FBD_NODES + ' bloques.');
    if (Array.isArray(fbd.connections) && fbd.connections.length > MAX_FBD_CONNECTIONS) errors.push('FBD supera el límite seguro de ' + MAX_FBD_CONNECTIONS + ' conexiones.');
    if (Array.isArray(fbd.nodes)) {
      fbd.nodes.forEach(function (node, index) {
        if (!isObject(node)) errors.push('El bloque FBD #' + (index + 1) + ' está dañado.');
        else if (strict && !node.type) errors.push('El bloque FBD #' + (index + 1) + ' no tiene tipo.');
        else if (!node.id) warnings.push('El bloque FBD #' + (index + 1) + ' no tiene identificador; se intentará regenerar.');
      });
    }
    if (Array.isArray(fbd.connections)) {
      fbd.connections.forEach(function (wire, index) {
        if (!isObject(wire)) errors.push('La conexión FBD #' + (index + 1) + ' está dañada.');
      });
    }
  }

  function validateLadder(ladder, errors, warnings, strict) {
    if (!isObject(ladder)) {
      errors.push('La sección Ladder no es válida.');
      return;
    }
    if (!Array.isArray(ladder.rungs)) errors.push('Ladder no contiene una lista rungs válida.');
    if (!Array.isArray(ladder.proWires)) errors.push('Ladder no contiene una lista proWires válida.');
    if (!Array.isArray(ladder.proJunctions)) errors.push('Ladder no contiene una lista proJunctions válida.');
    if (Array.isArray(ladder.rungs) && ladder.rungs.length > MAX_LADDER_RUNGS) errors.push('Ladder supera el límite seguro de ' + MAX_LADDER_RUNGS + ' líneas.');
    let elementCount = 0;
    if (Array.isArray(ladder.rungs)) {
      ladder.rungs.forEach(function (rung, rungIndex) {
        if (!isObject(rung)) {
          errors.push('La línea Ladder #' + (rungIndex + 1) + ' está dañada.');
          return;
        }
        if (!Array.isArray(rung.elements)) {
          errors.push('La línea Ladder #' + (rungIndex + 1) + ' no contiene una lista elements válida.');
          return;
        }
        elementCount += rung.elements.length;
        rung.elements.forEach(function (element, elementIndex) {
          if (!isObject(element)) errors.push('El elemento Ladder #' + (elementIndex + 1) + ' de la línea ' + (rungIndex + 1) + ' está dañado.');
          else if (strict && !element.type) errors.push('El elemento Ladder #' + (elementIndex + 1) + ' de la línea ' + (rungIndex + 1) + ' no tiene tipo.');
          else if (!element.id) warnings.push('Un elemento Ladder de la línea ' + (rungIndex + 1) + ' no tiene identificador.');
        });
      });
    }
    if (elementCount > MAX_LADDER_ELEMENTS) errors.push('Ladder supera el límite seguro de ' + MAX_LADDER_ELEMENTS + ' elementos.');
    if (Array.isArray(ladder.proWires) && ladder.proWires.length > MAX_LADDER_WIRES) errors.push('Ladder supera el límite seguro de ' + MAX_LADDER_WIRES + ' cables.');
    if (Array.isArray(ladder.proWires)) {
      ladder.proWires.forEach(function (wire, index) {
        if (!isObject(wire)) errors.push('El cable Ladder #' + (index + 1) + ' está dañado.');
      });
    }
    if (Array.isArray(ladder.proJunctions) && ladder.proJunctions.length > MAX_LADDER_JUNCTIONS) errors.push('Ladder supera el límite seguro de ' + MAX_LADDER_JUNCTIONS + ' puntos de unión.');
    if (Array.isArray(ladder.proJunctions)) {
      ladder.proJunctions.forEach(function (junction, index) {
        if (!isObject(junction)) errors.push('El punto de unión Ladder #' + (index + 1) + ' está dañado.');
        else if (!junction.id) warnings.push('El punto de unión Ladder #' + (index + 1) + ' no tiene identificador.');
        else if (!Number.isFinite(Number(junction.x)) || !Number.isFinite(Number(junction.y))) errors.push('El punto de unión Ladder #' + (index + 1) + ' no tiene coordenadas válidas.');
      });
    }
  }

  function validate(project, options) {
    options = options || {};
    const errors = [];
    const warnings = [];
    const config = global.SimuPLCConfig || { projectType: 'simuplc-project', projectSchemaVersion: 1 };
    if (!isObject(project)) return { ok: false, errors: ['El proyecto no es un objeto válido.'], warnings: [] };

    const incoming = Number(project.schemaVersion || project.version || 1) || 1;
    const supported = Number(config.projectSchemaVersion || 1) || 1;
    if (project.type === config.projectType && incoming > supported) {
      errors.push('El proyecto requiere el esquema ' + incoming + ' y esta versión admite hasta el ' + supported + '.');
    }
    if (project.type !== config.projectType) warnings.push('El tipo no es el formato canónico actual.');
    if (!isObject(project.editors)) {
      errors.push('Falta la sección editors.');
      return { ok: false, errors: errors, warnings: warnings };
    }
    validateFBD(project.editors.fbd, errors, warnings, !!options.strict);
    validateLadder(project.editors.ladder, errors, warnings, !!options.strict);
    if (project.activeEditor !== 'fbd' && project.activeEditor !== 'ladder') warnings.push('El editor activo no está definido correctamente; se usará FBD.');
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function validateImportSource(source) {
    const errors = [];
    const warnings = [];
    const config = global.SimuPLCConfig || { projectType: 'simuplc-project', projectSchemaVersion: 1, legacyDualProjectType: 'simuplc-dual-project' };
    if (!isObject(source)) return { ok: false, errors: ['El archivo no contiene un objeto de proyecto válido.'], warnings: [] };

    if (source.type === config.projectType) {
      const incoming = Number(source.schemaVersion || source.version || 1) || 1;
      const supported = Number(config.projectSchemaVersion || 1) || 1;
      if (incoming > supported) errors.push('Este archivo fue creado con una versión más reciente de SimuPLC Lab. Esquema requerido: ' + incoming + '.');
      if (!isObject(source.editors)) errors.push('El proyecto canónico no contiene la sección editors.');
    }

    const looksDual = !!(source.editors || source.fbd || source.ladder || source.type === config.legacyDualProjectType);
    const looksFBD = Array.isArray(source.nodes) || !!(source.data && Array.isArray(source.data.nodes));
    const looksLadder = Array.isArray(source.rungs) || source.type === 'ladder-phase9' || source.type === 'ladder-free-pro-industrial';
    if (!looksDual && !looksFBD && !looksLadder) errors.push('El archivo no parece contener un circuito FBD, Ladder ni un proyecto combinado.');

    if (!errors.length) {
      try {
        const migrated = migrate(source);
        const validation = validate(migrated, { strict: true });
        errors.push.apply(errors, validation.errors);
        warnings.push.apply(warnings, validation.warnings);
      } catch (error) {
        errors.push(String(error && error.message || error));
      }
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function toLegacyDual(project) {
    project = migrate(project);
    return {
      type: 'simuplc-dual-project',
      version: 2,
      name: project.name,
      savedAt: project.savedAt,
      activeEditor: project.activeEditor,
      editors: clone(project.editors),
      fbd: clone(project.editors.fbd),
      ladder: clone(project.editors.ladder),
      hardware: clone(project.hardware || {})
    };
  }

  global.SimuPLCProjectSchema = Object.freeze({
    emptyFBD: emptyFBD,
    emptyLadder: emptyLadder,
    normalizeFBD: normalizeFBD,
    normalizeLadder: normalizeLadder,
    createProject: createProject,
    migrate: migrate,
    validate: validate,
    validateImportSource: validateImportSource,
    toLegacyDual: toLegacyDual
  });
})(window);
