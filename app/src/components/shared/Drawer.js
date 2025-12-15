const { Row, EventDelegator } = Liteframe;

const Drawer = (props, childComponent) => {

  // --- Configuration ---
  const TRANSITION_DURATION_MS = 500; // Match the CSS transition duration

  // --- Close Handler (Delayed Destruction) ---
  // Assume TRANSITION_DURATION_MS = 500 (or 700, matching your longest CSS transition)

  const handleClose = () => {
    const drawerElement = document.getElementById('drawer-backdrop');

    if (drawerElement) {
      // --- 1. Apply Closing State ---

      // Find the Panel and Backdrop elements within the main container
      const backdrop = drawerElement.querySelector('.fixed.inset-0:not(.pointer-events-none)');
      const panel = drawerElement.querySelector('.pointer-events-auto');

      // Apply the 'data-closed' attribute to trigger the CSS transition
      // (Panel slides out, Backdrop fades out)
      if (backdrop) {
        backdrop.setAttribute('data-closed', 'true');
      }
      if (panel) {
        panel.setAttribute('data-closed', 'true');
      }

      // Note: We don't need to manually re-apply the 'data-closed' attribute to the main 
      // drawerElement itself, as the animation is handled by the inner elements (backdrop and panel).

      // --- 2. Schedule Destruction ---

      // Wait for the CSS transition to complete (TRANSITION_DURATION_MS)
      setTimeout(() => {
        // Use standard JavaScript .remove() method for DOM cleanup
        drawerElement.remove();
        // OR if using the parent's method: document.body.removeChild(drawerElement);
      }, TRANSITION_DURATION_MS);
    }
  }

  // --- Component Structure ---

  // 1. Backdrop Container (The 'Dialog' wrapper in React)
  const baseClasses = 'fixed inset-0 overflow-hidden z-10 '; // The main fixed container
  const drawer = Row({
    tagType: 'div',
    attributes: { id: 'drawer-backdrop' },
    class: `${baseClasses} ${props.class || ''}`
  });

  const delegator = new EventDelegator(drawer);

  // 2. Backdrop Overlay (The 'DialogBackdrop')
  const backdrop = Row({
    tagType: 'div',
    // Note: Starts hidden with data-closed:opacity-0. We rely on CSS to transition it open.
    // We will remove the 'data-closed' attribute right after mounting to trigger the open transition.
    class: 'fixed inset-0 bg-gray-900/50 transition-opacity duration-500 ease-in-out data-closed:opacity-0',
    attributes: { 'data-closed': 'true' } // Starts closed/hidden
  });

  // 3. Panel Container and Positioning
  const panelWrapper = Row({
    tagType: 'div',
    // Positioning: fixed right, full height, max-width
    class: 'pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16'
  }, [
    // 4. Dialog Panel (The Sliding Content Container)
    Row({
      tagType: 'div',
      class: 'pointer-events-auto w-screen max-w-md transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700',
      attributes: { 'data-closed': 'true' } // Starts closed/off-screen
    }, [
      childComponent(delegator, handleClose) // Pass close handler to content
    ])
  ]);

  // 5. Build the final DOM structure
  drawer.appendChild(backdrop);
  drawer.appendChild(Row({ tagType: 'div', class: 'absolute inset-0 overflow-hidden' }, [panelWrapper]));

  // 6. Mount to DOM
  document.body.appendChild(drawer);

  // 7. Imperative Open Transition (Remove 'data-closed' after DOM mount)
  // Use a small delay for mounting stability (often needed when triggering immediate transitions)
  setTimeout(() => {
    drawer.querySelector('.fixed.inset-0').removeAttribute('data-closed'); // Backdrop
    drawer.querySelector('.pointer-events-auto').removeAttribute('data-closed'); // Panel
  }, 10);

  // 8. Backdrop Click Handler (Attached to the main drawer element)
  drawer.addEventListener('click', (event) => {

    // Find the actual sliding panel content element (the one with w-screen/max-w-md)
    const panelElement = drawer.querySelector('.pointer-events-auto');

    // Logic: If the panel exists AND the click target is NOT inside the panel element
    // This is the robust way to check for clicks *outside* the panel.
    if (panelElement && !panelElement.contains(event.target)) {
      handleClose();
    }
  });

  // No return statement, following your pattern.
}


// --- Example Child Component (Combines Close Button and Content) ---
const DrawerContent = (delegator, handleClose) => {
  return Row({ tagType: 'div', class: 'h-full' }, [

    // Close Button Wrapper (Equivalent to TransitionChild wrapper for the button)
    Row({
      tagType: 'div',
      class: 'absolute top-0 left-0 -ml-8 flex pt-4 pr-2 duration-500 ease-in-out data-closed:opacity-0 sm:-ml-10 sm:pr-4',
      attributes: { 'data-closed': 'true' } // This wrapper needs to track closing state too
    }, [
      // Close Button
      Row({
        tagType: 'button',
        class: 'relative rounded-md text-gray-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
        events: { 'click': handleClose },
        delegator,
      }, [
        Row({ tagType: 'span', class: 'sr-only' }, 'Close panel'),
        // X Icon (Simplified SVG)
        Row({ tagType: 'svg', class: 'size-6', attributes: { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", 'stroke-width': "1.5" } }, [
          Row({ tagType: 'path', attributes: { d: "M6 18 18 6M6 6l12 12", 'stroke-linecap': "round", 'stroke-linejoin': "round" } })
        ])
      ])
    ]),

    // Main Drawer Body Content
    Row({
      tagType: 'div',
      class: 'relative flex h-full flex-col overflow-y-auto bg-gray-800 py-6 shadow-xl after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-white/10'
    }, [
      Row({ tagType: 'div', class: 'px-4 sm:px-6' }, [
        Row({ tagType: 'h2', class: 'text-base font-semibold text-white' }, 'Panel title')
      ]),
      Row({ tagType: 'div', class: 'relative mt-6 flex-1 px-4 sm:px-6' }, 'Your content here.')
    ])
  ]);
};

// You'd also need to manually handle the 'data-closed' attribute on the close button wrapper 
// inside the handleClose function for the smooth fade-out effect, similar to the main panel.

export {Drawer, DrawerContent};