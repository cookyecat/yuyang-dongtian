// v42 Web Worker：开页面时把预存里记下的嶙峋石先在后台线程算好（主线程同时在铺地形、盖房子），算完一块送回一块
import { craggyRockArrays } from './rockgen.js';
onmessage = (e) => {
  for (const [seed, res, squat] of e.data) {
    const A = craggyRockArrays(seed, { res, squat });
    postMessage({ seed, res, squat, A }, Object.values(A).map((a) => a.buffer));
  }
  postMessage(null);
};
