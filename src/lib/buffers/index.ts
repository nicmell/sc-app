import {BufferManager} from './BufferManager';

export * from './BufferManager';
export * from './SampleStream';

/** App-wide singleton. Holds one `SampleStream` per sc-buffer node. */
export const bufferManager = new BufferManager();
