/**
 * Drag type set when a library card is dragged. The search box reads it to show
 * similar references; the app-wide drop zone ignores it (it is not a new file or link).
 */
export const REFERENCE_DRAG_TYPE = "application/x-awen-reference"

/** Marks an element that handles its own drops, so the app-wide "drop to add" overlay stays hidden over it. */
export const LOCAL_DROP_ATTR = "data-local-drop"
