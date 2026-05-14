import type { z } from 'zod';
import { itemSchema } from '@shared/schema';

export type CatalogItem = z.infer<typeof itemSchema>;

/**
 * Default node `data` for a catalog item (matches Editor drop logic; no React callbacks).
 * Callers attach `onDelete` / `onUpdate` after spread.
 */
export function buildSeedDataFromCatalogItem(itemData: CatalogItem): Record<string, unknown> {
  let initialLabel = itemData.name;
  let variantIndex = 0;
  if (itemData.variants && itemData.variants.length > 0) {
    initialLabel = itemData.variants[0].name;
    variantIndex = 0;
  }

  const newNodeData: Record<string, unknown> = {
    label: initialLabel,
    category: itemData.category,
    specs: itemData.specs,
    itemId: itemData.id,
  };

  if (itemData.variants && itemData.variants.length > 0) {
    newNodeData.variants = itemData.variants;
    newNodeData.variantIndex = variantIndex;
  }

  if (
    (itemData.category === 'console' || itemData.category === 'custom') &&
    !itemData.specs?.isSVS &&
    !itemData.specs?.isCustomSwitch &&
    !itemData.specs?.isHDMISwitch &&
    itemData.specs?.outputs &&
    itemData.specs.outputs.length > 0
  ) {
    newNodeData.selectedOutput = itemData.specs.outputs[0];
  }

  if (itemData.specs?.isSVS === true || itemData.specs?.isCustomSwitch === true || itemData.specs?.isHDMISwitch === true) {
    const defaultSignalType = itemData.specs?.isHDMISwitch === true ? 'hdmi' : 'ypbpr';
    const initialInputs = itemData.specs?.initialInputs;
    const initialOutputs = itemData.specs?.initialOutputs;
    newNodeData.svsNumInputs = Array.isArray(initialInputs) ? initialInputs.length : 1;
    newNodeData.svsNumOutputs = Array.isArray(initialOutputs) ? initialOutputs.length : 1;
    newNodeData.svsInputs = Array.isArray(initialInputs) ? [...initialInputs] : [defaultSignalType];
    newNodeData.svsOutputs = Array.isArray(initialOutputs) ? [...initialOutputs] : [defaultSignalType];
  }

  if (itemData.category === 'display' && itemData.specs?.customizableInputs === true) {
    newNodeData.customInputs = [...(itemData.specs?.inputs || ['composite'])];
  }

  if (itemData.category === 'switch' && itemData.specs?.switchVariants?.length > 0) {
    const firstVariant = itemData.specs.switchVariants[0];
    newNodeData.switchVariantIndex = 0;
    newNodeData.label = firstVariant.name;
  }

  return newNodeData;
}
