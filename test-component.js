function createCounter() {
  let count = 0;

  return {
    increment: () => ++count,
    decrement: () => --count,
    reset: () => count = 0,
    getCount: () => count
  };
}

module.exports = { createCounter };