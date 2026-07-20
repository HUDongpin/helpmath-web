import type {AnimationModule} from './contract';
import {animationModuleLoaders} from './registry.generated';

export type {AnimationModuleLoader} from './registry.generated';
export type {AnimationModule} from './contract';

export const registeredAnimationKeys = Object.freeze(Object.keys(animationModuleLoaders));

export function hasAnimationModule(key: string): boolean {
  return Object.hasOwn(animationModuleLoaders, key);
}

export async function loadAnimationModule(key: string): Promise<AnimationModule | undefined> {
  return animationModuleLoaders[key]?.();
}
