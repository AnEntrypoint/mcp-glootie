
// Batch processing utilities
export function formatBatchSummary(operations, successfulOps) {
  const summaryLines = [];
  summaryLines.push(`Completed: ${successfulOps}/${operations.length} operations`);

  if (successfulOps === operations.length) {
    summaryLines.push('Status: All operations completed successfully');
  } else {
    summaryLines.push('Status: Some operations encountered issues');
  }

  summaryLines.push('The system automatically selected and configured the appropriate tools based on your task description.');

  return summaryLines.join('\n');
}