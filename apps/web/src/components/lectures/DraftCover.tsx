/** Обложка «Черновиков»: серый квадрат с пунктирной рамкой и карандашом (Screen-drafts). */

import { Icon } from "../../ui";

export default function DraftCover({ size = 40 }: { size?: number }) {
  return (
    <span className="c-draft-cover" style={{ width: size, height: size }} aria-hidden="true">
      <Icon name="edit" size={size >= 40 ? 18 : 12} />
    </span>
  );
}
