const query = window.matchMedia("(prefers-color-scheme: dark)");

function apply(): void {
  document.documentElement.classList.toggle("dark", query.matches);
}

export function initTheme(): void {
  apply();
  query.addEventListener("change", apply);
}

export function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}
