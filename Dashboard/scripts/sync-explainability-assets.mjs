import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourceDirectory = new URL('../../assets/', import.meta.url);
const destinationDirectory = new URL('../frontend/public/assets/model-explainability/', import.meta.url);
const figureNames = [
  'demand-rf-shap-bar.png',
  'demand-rf-shap-beeswarm.png',
  'demand-rf-shap-dependence.png',
  'demand-rf-shap-waterfall-largest-error.png',
  'demand-rf-shap-waterfall-missed-onset.png',
  'demand-rf-shap-waterfall-missing-history.png',
  'demand-rf-shap-waterfall-typical.png',
];

await mkdir(destinationDirectory, { recursive: true });
await Promise.all(figureNames.map((name) => copyFile(
  new URL(name, sourceDirectory),
  new URL(name, destinationDirectory),
)));

console.log(`Synced ${figureNames.length} published explainability figures to ${fileURLToPath(destinationDirectory)}`);
