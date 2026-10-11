import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Delete, Heart } from 'lucide-react';
import { useSession } from '../state/session';
import { getPinStatus, type ApiFailure } from '../lib/api';

type Step = 'question' | 'setup' | 'confirm' | 'enter';

const PAD_KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
];

/** Teclado numérico estilo passcode: círculos con rebote al presionar. */
function PinPad({ value, busy, onDigit, onBackspace }: {
  value: string;
  busy: boolean;
  onDigit: (d: string) => void;
  onBackspace: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-150 ${
              i < value.length ? 'scale-110 border-accent bg-accent' : 'border-muted/60 bg-transparent'
            }`}
          />
        ))}
      </div>
      <p className="sr-only" role="status">{value.length === 0 ? 'Código vacío' : `${value.length} de 4 dígitos`}</p>
      <div className="mx-auto mt-8 grid max-w-[300px] grid-cols-3 gap-x-4 gap-y-4" role="group" aria-label="Teclado numérico">
        {PAD_KEYS.map((k) => (
          <button
            key={k.digit}
            type="button"
            disabled={busy}
            onClick={() => onDigit(k.digit)}
            aria-label={`Dígito ${k.digit}`}
            className="grid h-[72px] w-[72px] place-items-center justify-self-center rounded-full border border-ink/10 bg-surface text-ink shadow-sm transition-all duration-150 hover:scale-105 hover:bg-surface-hover active:scale-90 disabled:opacity-50"
          >
            <span>
              <span className="block text-center text-[26px] font-medium leading-none">{k.digit}</span>
              {k.letters && (
                <span className="mt-0.5 block text-center text-[9px] font-semibold tracking-[0.2em] text-muted" aria-hidden="true">
                  {k.letters}
                </span>
              )}
            </span>
          </button>
        ))}
        <span aria-hidden="true" />
        <button
          type="button"
          disabled={busy}
          onClick={() => onDigit('0')}
          aria-label="Dígito 0"
          className="grid h-[72px] w-[72px] place-items-center justify-self-center rounded-full border border-ink/10 bg-surface text-[26px] font-medium text-ink shadow-sm transition-all duration-150 hover:scale-105 hover:bg-surface-hover active:scale-90 disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          disabled={busy || value.length === 0}
          onClick={onBackspace}
          aria-label="Borrar dígito"
          className="grid h-[72px] w-[72px] place-items-center justify-self-center rounded-full text-muted transition-all duration-150 hover:scale-105 hover:bg-surface-hover active:scale-90 disabled:opacity-30"
        >
          <Delete className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Puerta de acceso con PIN: pregunta secreta una sola vez y código de 4 dígitos. */
export function GateScreen() {
  const { pinLogin, pinSetup, busy, loginError, online } = useSession();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('enter');
  const [answer, setAnswer] = useState('');
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    getPinStatus()
      .then((s) => {
        if (!alive) return;
        setStep(s.memberPinSet ? 'enter' : 'question');
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        const f = e as ApiFailure;
        setLoadError(f?.message ?? 'No se pudo contactar al servidor.');
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function fail(text: string) {
    setLocalError(text);
    setShakeKey((n) => n + 1);
    setPin('');
  }

  const submitQuestion = useCallback((e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (answer.trim().length === 0) {
      setLocalError('Escribe la respuesta para continuar.');
      setShakeKey((n) => n + 1);
      return;
    }
    setPin('');
    setStep('setup');
  }, [answer]);

  const handleComplete = useCallback(async (code: string) => {
    setLocalError(null);
    try {
      if (step === 'setup') {
        setFirst(code);
        setPin('');
        setStep('confirm');
      } else if (step === 'confirm') {
        if (code !== first) {
          setFirst('');
          fail('Los códigos no coinciden. Inténtalo de nuevo.');
          setStep('setup');
          return;
        }
        await pinSetup(answer.trim(), code);
      } else {
        await pinLogin(code);
      }
    } catch {
      // loginError ya trae el texto en español desde el contexto.
      setShakeKey((n) => n + 1);
      setPin('');
      if (step === 'confirm') {
        setFirst('');
        setStep('setup');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, first, answer, pinSetup, pinLogin]);

  // Envío automático al completar los 4 dígitos (con pausa para ver el punto).
  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    timer.current = window.setTimeout(() => { void handleComplete(pin); }, 220);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [pin, busy, handleComplete]);

  function pushDigit(d: string) {
    setLocalError(null);
    setPin((p) => (p.length >= 4 ? p : p + d));
  }

  const titles: Record<Step, { title: string; subtitle: string }> = {
    question: { title: 'Una pregunta antes de entrar', subtitle: 'Sólo la primera vez.' },
    setup: { title: 'Crea tu código de 4 dígitos', subtitle: 'Sólo tú podrás usar la cuenta de invitado con este código.' },
    confirm: { title: 'Confirma tu código', subtitle: 'Escríbelo una vez más.' },
    enter: { title: 'Ingresa tu código', subtitle: 'El mismo código de 4 dígitos.' },
  };
  const copy = titles[step];

  return (
    <div className="relative grid min-h-dvh w-full place-items-center overflow-hidden p-4" aria-label="Acceso al chat">
      {/* Fondo decorativo blurred: siluetas del chat, sin datos reales (previo al login). */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-accent-soft via-canvas to-canvas" />
        <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-accent-soft blur-3xl" />
        <div className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full bg-line/70 blur-3xl" />
        <div className="absolute inset-x-0 top-0 mx-auto mt-10 w-full max-w-md space-y-3 px-8 opacity-60">
          <div className="flex justify-start"><div className="h-10 w-2/3 rounded-3xl rounded-bl-lg bg-surface" /></div>
          <div className="flex justify-end"><div className="h-10 w-1/2 rounded-3xl rounded-br-lg bg-accent-soft" /></div>
          <div className="flex justify-start"><div className="h-10 w-3/5 rounded-3xl rounded-bl-lg bg-surface" /></div>
          <div className="flex justify-end"><div className="h-10 w-2/5 rounded-3xl rounded-br-lg bg-accent-soft" /></div>
        </div>
        <div className="absolute inset-0 bg-canvas/60 backdrop-blur-2xl" />
      </div>

      <main className="enter-up relative w-full max-w-sm rounded-[2rem] border border-line/70 bg-surface p-6 text-center shadow-dialog sm:p-8">
        <span className="mx-auto inline-grid h-12 w-12 place-items-center rounded-2xl bg-accent text-on-accent">
          <Heart className="h-6 w-6" aria-hidden="true" />
        </span>
        <div key={step} className="enter-up">
          <h1 className="mt-3 text-2xl font-extrabold text-ink">{loading ? 'Hola de nuevo' : copy.title}</h1>
          <p className="mt-1 text-sm text-muted">{loading ? 'Preparando el acceso…' : copy.subtitle}</p>
        </div>

        {!online && (
          <p role="alert" className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            Sin conexión a internet. Conéctate para entrar.
          </p>
        )}
        {loading ? (
          <div className="mx-auto mt-8 max-w-[300px]" aria-label="Cargando acceso">
            <div className="flex items-center justify-center gap-5">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="h-3.5 w-3.5 animate-pulse rounded-full bg-line" />
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div className="mt-6">
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{loadError}</p>
            <button type="button" onClick={() => window.location.reload()}
              className="mt-4 min-h-[48px] w-full rounded-2xl bg-accent text-sm font-bold text-on-accent transition-all duration-200 hover:brightness-110 active:scale-[0.98]">
              Reintentar
            </button>
          </div>
        ) : step === 'question' ? (
          <form onSubmit={submitQuestion} className="mt-6">
            <label htmlFor="gate-answer" className="block text-lg font-semibold text-ink">
              Ingresa el nombre de mi chihuahua fallecido
            </label>
            <input
              id="gate-answer"
              type="text"
              autoComplete="off"
              autoFocus
              maxLength={100}
              value={answer}
              disabled={busy}
              onChange={(e) => { setAnswer(e.target.value); setLocalError(null); }}
              placeholder="Su nombre…"
              className="mt-4 min-h-[52px] w-full border-b-2 border-line bg-transparent px-2 text-center text-xl text-ink outline-none transition-colors placeholder:text-subtle focus:border-accent disabled:opacity-60"
            />
            <div key={shakeKey} className={shakeKey > 0 && localError ? 'shake' : undefined}>
              {localError && (
                <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                  {localError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={busy || answer.trim().length === 0}
              className="mt-6 min-h-[52px] w-full rounded-2xl bg-accent text-base font-bold text-on-accent shadow-sm transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              Continuar
            </button>
          </form>
        ) : (
          <div key={`${step}-${shakeKey}`} className={`mt-6 ${localError ? 'shake' : ''}`}>
            <PinPad value={pin} busy={busy} onDigit={pushDigit} onBackspace={() => setPin((p) => p.slice(0, -1))} />
            {(localError || loginError) && (
              <p role="alert" className="mx-auto mt-6 max-w-[300px] rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {localError ?? loginError}
              </p>
            )}
            {step === 'setup' && (
              <p className="mx-auto mt-6 max-w-[300px] text-xs leading-relaxed text-muted">
                Después de crearlo, nadie más podrá usar la cuenta de invitado sin este código.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
