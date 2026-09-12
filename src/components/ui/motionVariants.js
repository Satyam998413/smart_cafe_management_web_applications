// Ported unchanged from react_app/src/components/ui/motionVariants.js.
// Shared stagger-entrance variants for vertical lists (staff rows, chat
// threads, team chat directory) — one row/card fades+slides in slightly
// after the previous one instead of the whole list popping in at once.
export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } }
};

export const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }
};
