import type { FormEvent } from "react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";

type NoteFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function NoteForm({ value, onChange, onSubmit }: NoteFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        label="アイデアを入力"
        placeholder="例: 新しいプロジェクト管理テンプレート"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <Button type="submit" variant="primary" className="w-full">
        追加する
      </Button>
    </form>
  );
}
