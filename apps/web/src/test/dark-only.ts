// A bare dark palette class is unreadable in the light Apple theme. Classes with
// a dark: prefix are fine, since they only apply under the dark Festive theme.
const DARK_ONLY = /^(text-white|text-slate-|bg-slate-|border-slate-|text-violet-[34]00|text-(cyan|red|amber|emerald)-400|(bg|from|to)-[a-z]+-950)/;

export function darkOnlyClasses(container: HTMLElement) {
  return [...container.querySelectorAll("*")]
    .flatMap((element) => [...element.classList])
    .filter((name) => DARK_ONLY.test(name));
}
