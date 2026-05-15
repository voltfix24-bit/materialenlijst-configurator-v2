// Globale dirty state — buiten React zodat de sidebar er bij kan
let _isDirty = false;
const _listeners: Array<(dirty: boolean) => void> = [];

export function setGlobalDirty(dirty: boolean) {
  if (_isDirty === dirty) return;
  _isDirty = dirty;
  _listeners.forEach((fn) => fn(dirty));
}

export function getGlobalDirty(): boolean {
  return _isDirty;
}

export function onGlobalDirtyChange(fn: (dirty: boolean) => void) {
  _listeners.push(fn);
  return () => {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
  };
}
