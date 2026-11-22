export function foodReviewUpdateCount(status) {
  return (status?.needsInfo || 0) + (status?.reviewed || 0) + (status?.reviewer ? status.pending || 0 : 0);
}
