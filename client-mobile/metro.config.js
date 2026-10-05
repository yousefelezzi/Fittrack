// Lets the app import code that lives outside client-mobile: shared/ (used by
// the server too) and the web app's pure-JS helpers (calculators, WNS maths),
// so both clients use the same formulas.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [
  path.join(repoRoot, 'shared'),
  path.join(repoRoot, 'client-web/src/utils'),
  path.join(repoRoot, 'client-web/src/constants'),
];
// Those folders have no node_modules of their own.
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];
// client-web may have its own node_modules with another React; shared files
// that use hooks must get the app's React, or hooks break.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, 'App.jsx') }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
