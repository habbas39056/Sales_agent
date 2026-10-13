/**
 * Safely resolves a file/document URL for opening or downloading.
 * - Strips any hardcoded localhost URLs (e.g. http://localhost:5000 or http://localhost:5173).
 * - Ensures relative paths (/uploads/...) resolve against the current origin in production.
 * - Preserves legitimate external http/https URLs.
 */
export function getFileUrl(url) {
  if (!url) return '';
  let str = String(url).trim();
  if (str.startsWith('http://localhost:5000')) {
    str = str.replace('http://localhost:5000', '');
  } else if (str.startsWith('https://localhost:5000')) {
    str = str.replace('https://localhost:5000', '');
  } else if (str.startsWith('http://localhost:5173')) {
    str = str.replace('http://localhost:5173', '');
  } else if (str.startsWith('https://localhost:5173')) {
    str = str.replace('https://localhost:5173', '');
  }
  return str;
}

/**
 * Safely resolves deliverable / external links (e.g., Google Drive, Figma, or direct file).
 */
export function getDeliverableUrl(url) {
  if (!url) return '';
  const cleaned = getFileUrl(url);
  if (!cleaned) return '';
  if (cleaned.startsWith('/') || cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }
  return `https://${cleaned}`;
}
