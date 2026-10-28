import '@testing-library/jest-dom/vitest';
// jsdom lacks scrollIntoView, which Radix Select calls when highlighting an option.
// Node-environment suites (database tests) have no Element.
if (typeof Element !== 'undefined')
  Element.prototype.scrollIntoView ??= () => {};
