import type {AnimationModule} from './contract';
import {reviewDemoIds} from './catalog';

export type ReviewAnimationModuleLoader = () => Promise<AnimationModule>;

const candidateAnimationModuleLoaders: Readonly<Record<string, ReviewAnimationModuleLoader>> =
  Object.freeze({
    'conversion-1-2': () =>
      import('./modules/conversion-1-2').then(({default: animationModule}) => animationModule),
    'conversion-1-4': () =>
      import('./modules/conversion-1-4').then(({default: animationModule}) => animationModule),
  });

const reviewAnimationModuleLoaders: Readonly<Record<string, ReviewAnimationModuleLoader>> =
  Object.freeze(Object.fromEntries(
    reviewDemoIds.map((id) => [id, candidateAnimationModuleLoaders[id]] as const),
  ));

export const registeredReviewAnimationKeys = Object.freeze(
  Object.keys(reviewAnimationModuleLoaders),
);

export function hasReviewAnimationModule(key: string): boolean {
  return Object.hasOwn(reviewAnimationModuleLoaders, key);
}

export async function loadReviewAnimationModule(
  key: string,
): Promise<AnimationModule | undefined> {
  return reviewAnimationModuleLoaders[key]?.();
}
