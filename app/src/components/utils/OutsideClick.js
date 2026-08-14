export function ManageOutsideClick({containerEl, handleGetState, handleSetState}) {
  function handleClick(e) {
    const openId = handleGetState();
    if (!openId) return;

    const activeDropdown = containerEl.querySelector(
      `[data-action-id="${openId}"]`
    );

    if (!activeDropdown) {
      handleSetState()
      return;
    }

    if (!activeDropdown.contains(e.target)) {
      handleSetState()
    }
  }

  // Capture phase is intentional
  document.addEventListener('click', handleClick, true);

  return () => {
    document.removeEventListener('click', handleClick, true);
  };
}

/**
 * One document listener for all ActionDropdowns. If the clicked element is NOT inside
 * an element with [data-action-dropdown], close the current open dropdown.
 * getCurrentOpen() is invoked on each click and must return { getOpenState, setOpenState }.
 * Call once at module load (e.g. in Action.js).
 */
export function registerActionDropdownOutsideClickByTag(getCurrentOpen) {
  function handleClick(e) {
    if (e.target.closest && e.target.closest('[data-action-dropdown]')) return;
    const current = getCurrentOpen();
    if (current && current.getOpenState && current.getOpenState()) {
      current.setOpenState();
    }
  }
  document.addEventListener('click', handleClick, true);
  return () => document.removeEventListener('click', handleClick, true);
}

export function ManageDSOutsideClick({containerEl, getOpenState, setOpenState}) {
  function handleClick(e) {
    if (!getOpenState()) return;

    if (!containerEl.contains(e.target)) {
      setOpenState()
    }
  }

  document.addEventListener('click', handleClick, true);

  return () => {
    document.removeEventListener('click', handleClick, true);
  };
}

/**
 * One document listener for all DropdownSearch. If the clicked element is NOT inside
 * an element with [data-dropdown-search], close the current open dropdown.
 * getCurrentOpen() is invoked on each click and must return the open dropdown at that moment
 * (e.g. a function that returns a ref's .current). Call once at app/module load.
 */
export function registerDropdownOutsideClickByTag(getCurrentOpen) {
  function handleClick(e) {
    if (e.target.closest && e.target.closest('[data-dropdown-search]')) return;
    const current = getCurrentOpen();
    if (current && current.getOpenState && current.getOpenState()) {
      current.setOpenState();
    }
  }
  document.addEventListener('click', handleClick, true);
  return () => document.removeEventListener('click', handleClick, true);
}