/**
 * A bottom sheet: the one overlay the portal uses on a phone.
 *
 * Built on Radix Dialog for the same reason SidePanel is — the focus trap, the
 * inert background, Escape, the accessible name and the return of focus to the
 * control that opened it are all things a hand-rolled sheet gets wrong. The
 * title is required: a sheet with no name is an unlabelled dialog.
 *
 * FilterBar (contract section 4) opens its filters in this component. No page
 * has filters yet, so today the mobile navigation sheets are its only users.
 */
import type { ReactNode, RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useApp } from '../../app-context';
import { Icon } from '../../components/Icon';

export function BottomSheet({ open, onOpenChange, title, children, testId, returnFocusTo }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; testId: string;
  /** The control that opened the sheet. Radix returns focus to a Dialog.Trigger
   *  by itself; this sheet is opened from a button that is not one, so the
   *  caller names it. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const { t } = useApp();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="sheet" data-testid={testId} aria-describedby={undefined}
                        onCloseAutoFocus={(e) => { if (returnFocusTo?.current) { e.preventDefault(); returnFocusTo.current.focus(); } }}>
          <div className="sheet__head">
            <Dialog.Title className="sheet__title">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-btn" data-testid={`${testId}-close`}>
                <Icon name="close" /><span className="u-hidden-visually">{t('close')}</span>
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
