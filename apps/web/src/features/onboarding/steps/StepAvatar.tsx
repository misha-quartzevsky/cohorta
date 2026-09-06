import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

/** Экран 7 — аватар (необязательно, можно пропустить). */
export default function StepAvatar({ file, onFileChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="onb-step">
      <span className="onb-label">Фото профиля</span>
      <label className="onb-avatar-drop">
        {preview ? (
          <img src={preview} alt="Превью аватара" className="onb-avatar-preview" />
        ) : (
          <ImagePlus size={22} />
        )}
        <span className="onb-hint">
          {preview ? "Заменить фото" : "Загрузить фото"}
        </span>
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
