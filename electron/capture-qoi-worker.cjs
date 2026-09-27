const { parentPort } = require('node:worker_threads');
const { encodeCaptureQOI } = require('./capture-qoi.cjs');

parentPort.on('message', ({rgba,width,height}) => {
  try {
    const bytes=Uint8Array.from(encodeCaptureQOI(rgba,width,height));
    parentPort.postMessage({bytes},[bytes.buffer]);
  } catch(error) { parentPort.postMessage({error:error.message}); }
});
