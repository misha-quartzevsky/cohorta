/**
 * ============================================
 *  Header.tsx
 * ============================================
 *
 * Shared top-bar component used on every page.
 * Shows the Cohorta logo, an optional
 * «← Назад» back button when `onBack` is provided,
 * and the semester switcher on the right.
 */

import SemesterSwitcher from "./SemesterSwitcher";

interface Props {
  /** Callback fired when the back button is clicked. */
  onBack?: () => void;
}

/**
 * Renders the site header with brand logo, optional back
 * link and the semester switcher.
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
      <SemesterSwitcher />
    </header>
  );
}

export default Header;
