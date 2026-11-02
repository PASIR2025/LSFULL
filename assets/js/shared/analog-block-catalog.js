(function (global) {
  'use strict';

  if (global.SimuPLCAnalogCatalog) return;

  const TYPES = Object.freeze({
    CONST: 'analog_constant',
    INPUT: 'analog_input',
    SCALE: 'scale',
    GT: 'gt',
    LT: 'lt',
    EQ: 'eq',
    GTE: 'gte',
    LTE: 'lte',
    HYST: 'hyst',
    PWM: 'pwm_output',
    AO: 'analog_output',
    PID: 'pid',
    SPLIT: 'split_range'
  });

  const RAW_DEFINITIONS = [
    {
      type: TYPES.CONST,
      symbol: 'CONST',
      name: 'Constante analógica',
      shortName: 'Constante',
      family: 'source',
      inputType: null,
      outputType: 'analog',
      description: 'Entrega un valor analógico fijo interno para comparadores, escalamiento, PWM, AO y futuras consignas PID.',
      aliases: ['const', 'constant', 'analog_constant', 'constante', 'constante_analogica', 'constante analógica'],
      editors: { fbd: true, ladder: true },
      defaults: { value: 50, unit: '', decimals: 1 }
    },
    {
      type: TYPES.INPUT,
      symbol: 'AI',
      name: 'Entrada analógica',
      shortName: 'Entrada analógica',
      family: 'source',
      inputType: null,
      outputType: 'analog',
      description: 'Lee o simula una señal analógica y puede entregarla en valor RAW o en una unidad de ingeniería.',
      aliases: ['ai', 'analog-input', 'analoginput', 'entrada_analogica', 'entrada analógica'],
      editors: { fbd: true, ladder: true },
      defaults: { rawMin: 0, rawMax: 4095, engMin: 0, engMax: 100, rawValue: 0, unit: '%', decimals: 1, clamp: true }
    },
    {
      type: TYPES.SCALE,
      symbol: 'SCALE',
      name: 'Escalamiento',
      shortName: 'Escalamiento',
      family: 'processing',
      inputType: 'analog',
      outputType: 'analog',
      description: 'Convierte una señal de un rango de entrada a otro rango de salida.',
      aliases: ['scaler', 'escalar', 'escalamiento'],
      editors: { fbd: true, ladder: true },
      defaults: { inMin: 0, inMax: 100, outMin: 0, outMax: 100, unit: '', decimals: 1, clamp: true }
    },
    {
      type: TYPES.GT,
      symbol: '>',
      name: 'Mayor que',
      shortName: 'Mayor que',
      family: 'comparator',
      inputType: 'analog',
      outputType: 'digital',
      description: 'Activa su salida cuando la señal analógica es mayor que el valor configurado.',
      aliases: ['greater-than', 'greater_than', 'mayor'],
      editors: { fbd: true, ladder: true },
      defaults: { threshold: 50, unit: '', decimals: 1 }
    },
    {
      type: TYPES.LT,
      symbol: '<',
      name: 'Menor que',
      shortName: 'Menor que',
      family: 'comparator',
      inputType: 'analog',
      outputType: 'digital',
      description: 'Activa su salida cuando la señal analógica es menor que el valor configurado.',
      aliases: ['less-than', 'less_than', 'menor'],
      editors: { fbd: true, ladder: true },
      defaults: { threshold: 50, unit: '', decimals: 1 }
    },
    {
      type: TYPES.EQ,
      symbol: '=',
      name: 'Igual a',
      shortName: 'Igual a',
      family: 'comparator',
      inputType: 'analog',
      outputType: 'digital',
      description: 'Activa su salida cuando la señal se encuentra dentro de la tolerancia del valor configurado.',
      aliases: ['equal', 'equal-to', 'igual'],
      editors: { fbd: true, ladder: true },
      defaults: { threshold: 50, tolerance: 0.1, unit: '', decimals: 1 }
    },
    {
      type: TYPES.GTE,
      symbol: '≥',
      name: 'Mayor o igual',
      shortName: 'Mayor o igual',
      family: 'comparator',
      inputType: 'analog',
      outputType: 'digital',
      description: 'Activa su salida cuando la señal analógica es mayor o igual que el valor configurado.',
      aliases: ['greater-or-equal', 'greater_equal', 'mayor_igual', '>='],
      editors: { fbd: true, ladder: true },
      defaults: { threshold: 50, unit: '', decimals: 1 }
    },
    {
      type: TYPES.LTE,
      symbol: '≤',
      name: 'Menor o igual',
      shortName: 'Menor o igual',
      family: 'comparator',
      inputType: 'analog',
      outputType: 'digital',
      description: 'Activa su salida cuando la señal analógica es menor o igual que el valor configurado.',
      aliases: ['less-or-equal', 'less_equal', 'menor_igual', '<='],
      editors: { fbd: true, ladder: true },
      defaults: { threshold: 50, unit: '', decimals: 1 }
    },
    {
      type: TYPES.HYST,
      symbol: 'HYS',
      name: 'Histéresis',
      shortName: 'Histéresis',
      family: 'comparator',
      inputType: 'analog',
      outputType: 'digital',
      description: 'Usa un umbral de encendido y otro de apagado para evitar conmutaciones rápidas.',
      aliases: ['hys', 'hysteresis', 'histeresis', 'histéresis'],
      editors: { fbd: true, ladder: true },
      defaults: { low: 40, high: 60, unit: '', decimals: 1, hystState: 0 }
    },
    {
      type: TYPES.PID,
      symbol: 'PID',
      name: 'Controlador PID',
      shortName: 'PID',
      family: 'processing',
      inputType: 'analog',
      outputType: 'analog',
      description: 'Compara PV con SP y calcula una salida analógica con acción proporcional, integral y derivativa.',
      aliases: ['pid', 'pid_controller', 'controlador_pid', 'controlador pid'],
      editors: { fbd: true, ladder: true },
      defaults: { kp: 2, ki: 0.5, kd: 0.1, sampleMs: 100, outMin: 0, outMax: 100, mode: 'auto', manualOutput: 0, direction: 'heating', unit: '%', decimals: 1 }
    },
    {
      type: TYPES.SPLIT,
      symbol: 'SPLIT',
      name: 'Control bidireccional / Split Range',
      shortName: 'Split Range',
      family: 'processing',
      inputType: 'analog',
      outputType: 'analog',
      outputCount: 2,
      outputRoles: ['LLENAR', 'VACIAR'],
      description: 'Divide una salida analógica alrededor de un punto neutro: una salida proporcional para llenar/avanzar y otra para vaciar/retroceder, con zona muerta y enclavamiento.',
      aliases: ['split', 'split-range', 'split_range', 'rango_dividido', 'control_bidireccional', 'control bidireccional'],
      editors: { fbd: true, ladder: true },
      defaults: { inMin: 0, inMax: 100, neutral: 50, deadband: 2, outMax: 100, unit: '%', decimals: 1, clamp: true }
    },
    {
      type: TYPES.PWM,
      symbol: 'PWM',
      name: 'Salida PWM',
      shortName: 'Salida PWM',
      family: 'output',
      inputType: 'analog',
      outputType: null,
      description: 'Convierte una señal analógica en ciclo de trabajo PWM para velocidad, iluminación o potencia.',
      aliases: ['pwm', 'pwm_output', 'salida_pwm', 'salida pwm'],
      editors: { fbd: true, ladder: true },
      defaults: { inMin: 0, inMax: 100, unit: '%', decimals: 1, clamp: true, frequency: 1000, resolution: 8 }
    },
    {
      type: TYPES.AO,
      symbol: 'AO',
      name: 'Salida analógica',
      shortName: 'Salida analógica',
      family: 'output',
      inputType: 'analog',
      outputType: null,
      description: 'Convierte una señal de ingeniería en una salida DAC analógica real cuando la placa dispone de DAC.',
      aliases: ['ao', 'analog_output', 'salida_analogica', 'salida analógica'],
      editors: { fbd: true, ladder: true },
      defaults: { inMin: 0, inMax: 100, unit: '%', decimals: 1, clamp: true, voltageMin: 0, voltageMax: 3.3, outputUnit: 'V' }
    }
  ];

  function deepFreezeDefinition(definition) {
    const clone = Object.assign({}, definition, {
      aliases: Object.freeze((definition.aliases || []).slice()),
      editors: Object.freeze(Object.assign({}, definition.editors || {})),
      defaults: Object.freeze(Object.assign({}, definition.defaults || {}))
    });
    return Object.freeze(clone);
  }

  const DEFINITIONS = Object.freeze(RAW_DEFINITIONS.map(deepFreezeDefinition));
  const BY_TYPE = new Map();
  const ALIASES = new Map();

  function normalizeKey(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  DEFINITIONS.forEach(function (definition) {
    BY_TYPE.set(definition.type, definition);
    ALIASES.set(normalizeKey(definition.type), definition.type);
    ALIASES.set(normalizeKey(definition.symbol), definition.type);
    (definition.aliases || []).forEach(function (alias) {
      ALIASES.set(normalizeKey(alias), definition.type);
    });
  });

  function normalizeType(value) {
    const key = normalizeKey(value);
    return ALIASES.get(key) || key;
  }

  function get(value) {
    return BY_TYPE.get(normalizeType(value)) || null;
  }

  function list() {
    return DEFINITIONS.slice();
  }

  function isAnalog(value) {
    return !!get(value && typeof value === 'object' ? value.type : value);
  }

  function isSource(value) {
    const definition = get(value && typeof value === 'object' ? value.type : value);
    return !!definition && definition.outputType === 'analog';
  }

  function isOutput(value) {
    const definition = get(value && typeof value === 'object' ? value.type : value);
    return !!definition && definition.family === 'output';
  }

  function isComparator(value) {
    const definition = get(value && typeof value === 'object' ? value.type : value);
    return !!definition && definition.family === 'comparator';
  }

  function symbolFor(value, fallback) {
    const definition = get(value);
    return definition ? definition.symbol : (fallback == null ? String(value || '').toUpperCase() : fallback);
  }

  function nameFor(value, fallback) {
    const definition = get(value);
    return definition ? definition.name : (fallback == null ? String(value || '') : fallback);
  }

  function shortNameFor(value, fallback) {
    const definition = get(value);
    return definition ? definition.shortName : nameFor(value, fallback);
  }

  function descriptionFor(value, fallback) {
    const definition = get(value);
    return definition ? definition.description : (fallback || '');
  }

  function defaultParamsFor(value) {
    const definition = get(value);
    return definition ? Object.assign({}, definition.defaults) : {};
  }

  function supportsEditor(value, editor) {
    const definition = get(value);
    if (!definition || !definition.editors) return false;
    return definition.editors[String(editor || '').toLowerCase()] || false;
  }

  function decorateLibraryElement(element) {
    if (!element || !element.dataset) return null;
    const definition = get(element.dataset.type);
    if (!definition) return null;
    element.dataset.analogCatalog = '1';
    element.dataset.analogFamily = definition.family;
    element.dataset.inputSignal = definition.inputType || 'none';
    element.dataset.outputSignal = definition.outputType || 'none';
    element.setAttribute('aria-label', definition.name + ' (' + definition.symbol + ')');
    element.title = definition.name + ': ' + definition.description;
    return definition;
  }

  global.SimuPLCAnalogCatalog = Object.freeze({
    version: 7,
    TYPES: TYPES,
    definitions: DEFINITIONS,
    normalizeType: normalizeType,
    get: get,
    list: list,
    isAnalog: isAnalog,
    isSource: isSource,
    isComparator: isComparator,
    isOutput: isOutput,
    symbolFor: symbolFor,
    nameFor: nameFor,
    shortNameFor: shortNameFor,
    descriptionFor: descriptionFor,
    defaultParamsFor: defaultParamsFor,
    supportsEditor: supportsEditor,
    decorateLibraryElement: decorateLibraryElement,
    getDiagnostics: function () {
      return {
        ok: true,
        module: 'analog-block-catalog',
        version: 7,
        definitionCount: DEFINITIONS.length,
        fbdReady: DEFINITIONS.every(function (item) { return item.editors.fbd === true; }),
        ladderAIReady: supportsEditor(TYPES.INPUT, 'ladder') === true,
        ladderAnalogReady: DEFINITIONS.every(function (item) { return item.editors.ladder === true; }),
        ladderPlannedCount: DEFINITIONS.filter(function (item) { return item.editors.ladder === 'planned'; }).length
      };
    }
  });
})(window);
