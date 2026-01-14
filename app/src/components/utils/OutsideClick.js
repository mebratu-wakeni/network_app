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

