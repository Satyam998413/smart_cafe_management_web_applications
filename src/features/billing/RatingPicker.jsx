'use client';

// The vision doc's "smart screen with emojis" (see rating_screen.dart's
// RatingEmojiPicker for the reference UX) — a 1-5 emoji scale rendered as a
// radiogroup so screen readers announce it as one control with 5 choices,
// not 5 unrelated buttons. Every option is a 46px square (> the 44px
// minimum touch target the task's accessibility standard calls for).
const LEVELS = [
  { value: 1, emoji: '😞', label: 'Very bad' },
  { value: 2, emoji: '🙁', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Excellent' }
];

export default function RatingPicker({ label, value, onChange }) {
  return (
    <div>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
        {label}
      </span>
      <div className="rating-picker" role="radiogroup" aria-label={label}>
        {LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            role="radio"
            aria-checked={value === level.value}
            aria-label={`${level.label} (${level.value} of 5)`}
            title={level.label}
            className={`rating-option ${value === level.value ? 'selected' : ''}`}
            onClick={() => onChange(level.value)}
          >
            <span aria-hidden="true">{level.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
