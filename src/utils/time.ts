export function getRelativeTime(timestamp?: number): string {
  if (!timestamp) return 'recently';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  
  if (diff < 60) {
    return 'just now';
  }
  
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'yesterday';
  }
  return `${days}d ago`;
}
