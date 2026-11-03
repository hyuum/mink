/** Pixelify Sans, for the Pixel Hearth skin: fetched the first time the skin is shown, not for everyone. */
export function loadSkinFont() {
  if (typeof document === 'undefined' || document.getElementById('skin-font')) return;
  const link = document.createElement('link');
  link.id = 'skin-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap';
  document.head.appendChild(link);
}
