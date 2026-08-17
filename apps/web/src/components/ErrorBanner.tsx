/**
 * ============================================
 *  ErrorBanner.tsx
 * ============================================
 *
 * Reusable error display strip.  Renders a colored
 * banner with the error message when `message` is
 * non-empty.
 */

interface Props {
  /** Error message to display. Empty string = no banner. */
  message: string;
}

/**
 * Renders an error banner at the top of the page.
 *
 * @param Props.message — the error text to show
 */
function ErrorBanner({ message }: Props) {
  if (!message) return null;
  return <div className="error-banner">{message}</div>;
}

export default ErrorBanner;