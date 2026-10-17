import { proxyStream } from '@/server/streamProxy';

// An event stream: relayed by hand so the backend connection closes with the browser's.
export const GET = proxyStream;
