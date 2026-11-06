/** Brief icon-only tap feedback; no persistent selected background. */
export function iconFeedback(button: HTMLButtonElement) {
  button.querySelector('svg')?.animate([{ color: '#6FEE79' }, { color: 'currentColor' }], { duration: 160 });
}
