// This file is the Vercel Serverless Function entry point.
// It is a pre-compiled JavaScript file built by esbuild during the build step.
// Source: src/server/app.ts
const { app } = require('../dist-server/src/server/app.js');

module.exports = app;
