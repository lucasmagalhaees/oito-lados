// Mutation testing of the pure core: does tests/unit.cases.mjs catch the mistakes it claims to catch?
//   npm run mutation                              every module of src/core (over two hours on two cores)
//   npm run mutation -- --mutate src/core/fx.ts   one module (a few minutes); a comma-separated list for several
// Stryker plants one small mistake at a time in src/core (a `<` turned into `<=`, a `+` into `-`, a `return` removed...)
// and runs `node tests/core.mjs`, the same cases tests/unit.py runs in the browser. A mistake the cases do not notice
// "survives". The report lands in reports/mutation/ (HTML and JSON), outside the repository.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'command',
  commandRunner: { command: 'node tests/core.mjs' },
  // types.ts only declares shapes and index.ts only gathers the modules: nothing in them can be mutated into wrong behaviour
  mutate: ['src/core/**/*.ts', '!src/core/types.ts', '!src/core/index.ts'],
  coverageAnalysis: 'off',          // the command runner cannot tell which case covers which mutant: every mutant runs everything
  concurrency: 2,
  timeoutMS: 10000,                 // a mutant that turns a loop endless (the bisection in pricing) is killed by time
  ignorePatterns: ['dist', 'reports', 'tests/.build', 'tests/.coverage', 'tests/node_modules', 'tests/shots', '.claude', '.vercel'],
  tempDirName: '.stryker-tmp',
  // TypeScript 7 is the native compiler, without the JavaScript API Stryker uses to rewrite tsconfig.json for the sandbox.
  // Nothing run here reads tsconfig.json (the build strips types without checking them), so point Stryker at no file.
  tsconfigFile: 'tsconfig.none.json',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  clearTextReporter: { allowColor: false, logTests: false, reportMutants: false },
  thresholds: { high: 90, low: 80, break: null },
};
