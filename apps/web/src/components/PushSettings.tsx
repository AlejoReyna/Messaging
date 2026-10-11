import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useSession } from '../state/session';
import { deletePushSubscription, getVapidKey, savePushSubscription, type ApiFailure } from '../lib/api';
import {
  currentBrowserSubscription,
  isPushSupported,
  isStandalone,
  pushPermission,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
} from '../lib/push';

/** Ajuste de notificaciones push (contrato v5): aviso genérico "Nuevo mensaje", sin texto. */
export function PushSettings() {
  const { csrfToken } = useSession();
  const [supported] = useState(() => isPushSupported());
  const [standalone, setStandalone] = useState(false);
  const [permission, setPermission] = useState<'default' | 'denied' | 'granted'>('default');
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null);
  const [active, setActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setStandalone(isStandalone());
    setPermission(pushPermission());
    if (!isPushSupported()) {
      setActive(false);
      return;
    }
    try {
      const key = await getVapidKey();
      setServerEnabled(key.enabled);
      if (!key.enabled) {
        setActive(false);
        return;
      }
    } catch {
      setServerEnabled(false);
      setActive(false);
      return;
    }
    try {
      const current = await currentBrowserSubscription();
      setActive(!!current);
    } catch {
      setActive(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const key = await getVapidKey();
      setServerEnabled(key.enabled);
      if (!key.enabled || !key.publicKey) {
        setMsg({ kind: 'err', text: 'Avisos desactivados en el servidor. Avísale al administrador.' });
        return;
      }
      const { dto } = await subscribeBrowserPush(key.publicKey);
      await savePushSubscription(dto, csrfToken);
      setActive(true);
      setPermission(pushPermission());
      setMsg({ kind: 'ok', text: 'Notificaciones activadas en este iPhone. Llegarán como “Nuevo mensaje”.' });
    } catch (err) {
      const f = err as ApiFailure;
      const text = err instanceof Error && err.message.includes('denegado')
        ? 'Permiso denegado. Actívalo en Ajustes del iPhone > Notificaciones > Chat.'
        : (f?.message ?? 'No se pudieron activar. Inténtalo de nuevo.');
      setMsg({ kind: 'err', text });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const endpoint = await unsubscribeBrowserPush();
      if (endpoint) {
        try {
          await deletePushSubscription(endpoint, csrfToken);
        } catch {
          // La suscripción local ya se canceló; el servidor la podará solo.
        }
      } else {
        // Sin suscripción local: intenta limpiar por si quedó huérfana.
        const current = null;
        void current;
      }
      setActive(false);
      setPermission(pushPermission());
      setMsg({ kind: 'ok', text: 'Notificaciones desactivadas en este iPhone.' });
    } catch {
      setMsg({ kind: 'err', text: 'No se pudieron desactivar. Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <section aria-label="Notificaciones" className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 text-left">
        <h3 className="text-sm font-bold text-ink">Notificaciones</h3>
        <p className="mt-1 text-sm text-muted">Este navegador no admite notificaciones push.</p>
      </section>
    );
  }

  const isActive = active === true;
  return (
    <section aria-label="Notificaciones" className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 text-left">
      <div className="flex items-center gap-2">
        {isActive
          ? <Bell className="h-4 w-4 text-ink" aria-hidden="true" />
          : <BellOff className="h-4 w-4 text-ink" aria-hidden="true" />}
        <h3 className="text-sm font-bold text-ink">Notificaciones en este iPhone</h3>
      </div>
      <p className="mt-1 text-sm text-muted">
        Aviso del sistema como el del banco, pero genérico: sólo dice “Nuevo mensaje”, sin texto ni fotos.
      </p>
      {serverEnabled === false && (
        <p role="status" className="mt-2 text-sm font-medium text-amber-900">
          Avisos desactivados en el servidor.
        </p>
      )}
      {!standalone && serverEnabled !== false && (
        <p role="status" className="mt-2 text-sm text-muted">
          En iPhone instálala desde Compartir › Añadir a pantalla de inicio y ábrela desde el icono para activarlas (iOS 16.4+).
        </p>
      )}
      {permission === 'denied' && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-800">
          Permiso bloqueado. Actívalo en Ajustes del iPhone › Notificaciones › Chat.
        </p>
      )}
      {msg && (
        <p role={msg.kind === 'err' ? 'alert' : 'status'}
          className={`mt-2 rounded-2xl px-3 py-2 text-sm font-medium ${msg.kind === 'err' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'}`}>
          {msg.text}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {isActive ? (
          <button type="button" onClick={() => void disable()} disabled={busy}
            className="min-h-[48px] flex-1 rounded-2xl bg-surface px-4 text-sm font-bold text-ink transition-all duration-200 hover:brightness-95 active:scale-[0.98] disabled:opacity-60">
            {busy ? 'Apagando…' : 'Desactivar en este iPhone'}
          </button>
        ) : (
          <button type="button" onClick={() => void enable()} disabled={busy}
            className="min-h-[48px] flex-1 rounded-2xl bg-accent px-4 text-sm font-bold text-on-accent transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
            {busy ? 'Activando…' : 'Activar notificaciones'}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Estado: {active === null ? 'comprobando…' : isActive ? 'activadas' : 'desactivadas'}
        {permission !== 'default' ? ` · permiso ${permission === 'granted' ? 'concedido' : 'denegado'}` : ''}
      </p>
    </section>
  );
}
