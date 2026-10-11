import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SendHorizontal } from 'lucide-react';
import { MAX_MESSAGE_LENGTH } from '@private-chat/contracts';

export function Composer({
  onSend, onTyping, disabled, placeholder,
}: {
  onSend: (body: string) => Promise<void> | void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const stopTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    onTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(v: string) {
    setValue(v);
    if (disabled) return;
    onTyping(v.trim().length > 0);
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(() => onTyping(false), 4000);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = value.trim();
    if (!body || sending || disabled) return;
    if (body.length > MAX_MESSAGE_LENGTH) return;
    setSending(true);
    onTyping(false);
    try {
      await onSend(body);
      setValue('');
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - value.trim().length;
  const canSend = !disabled && !sending && value.trim().length > 0;

  return (
    <form onSubmit={submit} className="flex items-center gap-2" aria-label="Enviar mensaje">
      <label htmlFor="composer" className="sr-only">Escribe un mensaje</label>
      <input
        ref={inputRef}
        id="composer"
        type="text"
        autoComplete="off"
        enterKeyHint="send"
        maxLength={MAX_MESSAGE_LENGTH + 100}
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? 'Escribe un mensaje…'}
        className="min-h-[52px] min-w-0 flex-1 rounded-full border border-line bg-surface-muted px-5 text-[16px] text-ink shadow-sm placeholder:text-muted transition-shadow duration-200 focus:border-accent focus:shadow-md disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || sending || value.trim().length === 0}
        aria-label="Enviar mensaje"
        className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-accent text-on-accent shadow-sm transition-all duration-200 hover:bg-accent-hover active:scale-90 ${
          canSend ? 'scale-100 hover:scale-105' : 'scale-95 opacity-60'
        } disabled:opacity-50`}
      >
        <SendHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>
      {value.trim().length > MAX_MESSAGE_LENGTH - 200 && (
        <span aria-live="polite" className="sr-only">Quedan {remaining} caracteres.</span>
      )}
    </form>
  );
}
