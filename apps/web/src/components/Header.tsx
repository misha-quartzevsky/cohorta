/**
 * ============================================
 *  Header.tsx
 * ============================================
 *
 * Shared top-bar component used on every page.
 * Shows the Cohorta logo and an optional
 * «← Назад» back button when `onBack` is provided.
 */

interface Props {
  /** Callback fired when the back button is clicked. */
  onBack?: () => void;
}

/**
 * Renders the site header with brand logo and optional back link.
 *
 * @param Props.onBack — if present, renders a «Назад» button
 */
function Header({ onBack }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        {onBack && (
          <button className="back-link" onClick={onBack} type="button">
            ← Назад
          </button>
        )}
        <img src="/cohorta-black.svg" alt="Cohorta" />
      </div>
    </header>
  );
}

export default Header;