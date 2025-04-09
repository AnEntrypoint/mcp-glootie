// Utility function to calculate total price of items
export function calculateTotal(items) {
  let total = 0;
  for (let item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

// Utility function to get current timestamp
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

// Utility function to create a result object
export function createResultObject(items, total) {
  return {
    items,
    total,
    calculatedAt: getCurrentTimestamp()
  };
} 