#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
node tools/tests/static-checks.mjs
node tools/tests/pwa-shell-check.mjs
node tools/tests/analog-catalog.mjs
python3 tools/tests/analog-library-visual.py
node tools/tests/fbd-simulation-engine.mjs
python3 tools/tests/browser-smoke.py
python3 tools/tests/fbd-simulation.py
python3 tools/tests/fbd-analog.py
python3 tools/tests/fbd-analog-mobile.py
python3 tools/tests/integration-recovery.py
python3 tools/tests/project-modules.py
python3 tools/tests/editor-bridge.py

python3 tools/tests/references-phase2.py
python3 tools/tests/documentation-unified.py
python3 tools/tests/documentation-mobile.py

# Paso 9 valida que el nodo siga la unión visual real de los cables.
python3 tools/tests/ladder-auto-junctions.py
