import animation from '../demos/modules/conversion-1-2';

import {createExecutiveDemoRuntime} from './create-runtime';

const runtime = createExecutiveDemoRuntime(animation);

export const mount = runtime.mount;
export const unmount = runtime.unmount;
