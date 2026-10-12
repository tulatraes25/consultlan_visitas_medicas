import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const config = JSON.parse(read('apps/mobile/app.json')).expo;
const packageJson = JSON.parse(read('apps/mobile/package.json'));
const fixtures = read('apps/mobile/src/demoData.ts');
const app = read('apps/mobile/App.tsx');
const theme = read('apps/mobile/src/theme.ts');

test('mobile project is deliberately demo only, supports iPad and stays independent', () => {
  assert.equal(config.extra.demoOnly, true);
  assert.equal(config.extra.clinicalAccessEnabled, false);
  assert.equal(config.ios.supportsTablet, true);
  assert.equal(config.updates.enabled, false);
  assert.equal(packageJson.private, true);
  assert.match(packageJson.dependencies.expo, /^~57\./);
});
test('real CONSULTLAN Pediatrics brand tokens are used', () => {
  for (const hex of ['#166534','#0B3D2A','#DDF5E6','#F4F6F8']) {
    assert.ok(theme.includes(hex),hex);
  }
});
test('all fixtures are visibly synthetic and no network functions are embedded', () => {
  assert.match(fixtures,/Paciente ficticio A/);
  assert.match(fixtures,/DEMO-0001/);
  assert.doesNotMatch(fixtures,/https?:\/\//i);
  assert.doesNotMatch(app,/\bfetch\s*\(|\baxios\b|AsyncStorage|SecureStore/);
  assert.match(app,/MODO DEMO|DemoBanner/);
});
test('home, agenda, detail and explicit non-operational clinical messages exist', () => {
  for (const screen of ['HomePanel','AgendaPanel','VisitDetail']) assert.ok(app.includes(screen));
  assert.match(app,/no accede a historias clínicas/i);
  assert.match(app,/No es posible iniciar una visita real/i);
  assert.match(app,/isTablet/);
});

test('signature sketch is explicitly discarded and cannot persist or claim legal signing', () => {
  const signature = read('apps/mobile/src/AttendanceSignatureDemo.tsx');
  assert.match(signature,/if \(!visible\) return null/);
  assert.match(signature,/Trazos: /);
  assert.match(signature,/no se transmiten, autentican ni incorporan a documentos/);
  assert.match(signature,/SIMULACIÓN SIN VALIDEZ LEGAL/);
  assert.doesNotMatch(signature,/\bfetch\s*\(|AsyncStorage|SecureStore|FileSystem|expo-file-system|axios|upload|saveAsync|createDocument/);
  assert.equal(packageJson.dependencies['react-native-svg'], '15.15.4');
});

test('HC-UX-04D one locked staging composition cannot be mounted in demo',()=>{
  const canonical=read('apps/mobile/src/StagingProfessionalWorkflowPreview.tsx');
  assert.equal(existsSync(new URL(
    '../apps/mobile/src/StagingProfessionalFlowPreview.tsx',import.meta.url,
  )),false,'independently injected dual-controller component must stay retired');
  assert.doesNotMatch(app,/StagingProfessionalWorkflowPreview/);
  assert.match(canonical,/roster:createPagedCoverageController\(config\)/);
  assert.match(canonical,/form:createAssignedFormSessionController\(config\)/);
  assert.match(canonical,/selected\.rosterSnapshot===roster/);
  assert.match(canonical,/no-hide-descendants/);
});
