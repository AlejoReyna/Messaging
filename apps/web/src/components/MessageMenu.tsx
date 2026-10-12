import { useLayoutEffect, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Fuera del historial: sus bordes y scroll no recortan las opciones. */
export function MessageMenu({ anchorRef, menuRef, label, children }: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  label: string;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const history = anchor.closest('.chat-scroll');
    const viewport = window.visualViewport;

    function position() {
      if (!anchor || !menu) return;
      const margin = 8;
      const gap = 4;
      const visible = {
        left: (viewport?.offsetLeft ?? 0) + margin,
        top: (viewport?.offsetTop ?? 0) + margin,
        right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - margin,
        bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - margin,
      };
      menu.style.maxWidth = `${Math.max(0, visible.right - visible.left)}px`;
      menu.style.maxHeight = `${Math.max(0, visible.bottom - visible.top)}px`;
      const size = menu.getBoundingClientRect();
      const trigger = anchor.getBoundingClientRect();
      const chat = history?.getBoundingClientRect();
      // Normalmente permanecer dentro del historial, por encima del compositor.
      // Con teclado/viewport muy pequeño, usar el espacio visible de la pantalla.
      const chatTop = Math.max(visible.top, (chat?.top ?? visible.top) + margin);
      const chatBottom = Math.min(visible.bottom, (chat?.bottom ?? visible.bottom) - margin);
      const fitsInChat = chat && chatBottom - chatTop >= size.height;
      const topEdge = fitsInChat ? chatTop : visible.top;
      const bottomEdge = fitsInChat ? chatBottom : visible.bottom;
      const below = trigger.bottom + gap;
      const above = trigger.top - gap - size.height;
      const top = below + size.height <= bottomEdge ? below : above >= topEdge ? above
        : Math.min(Math.max(below, topEdge), bottomEdge - size.height);
      const left = Math.min(Math.max(trigger.right - size.width, visible.left), visible.right - size.width);
      // Propiedades CSSOM individuales: compatibles con style-src 'self'.
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    position();
    menu.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(position);
    observer?.observe(menu);
    observer?.observe(anchor);
    if (history) observer?.observe(history);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      viewport?.removeEventListener('resize', position);
      viewport?.removeEventListener('scroll', position);
      observer?.disconnect();
    };
  }, [anchorRef, menuRef]);

  return createPortal(
    <div ref={menuRef} role="menu" aria-label={label}
      onTouchStart={(event) => event.stopPropagation()}
      className="message-options-menu fixed z-40 w-56 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
      {children}
    </div>, document.body,
  );
}
