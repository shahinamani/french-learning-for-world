/**
 * The exam switcher at the top of the sidebar: which exam this learner is
 * preparing for. The pattern is shadcn/ui's team switcher (a dropdown menu on
 * Radix), because it is the one learners already know from other apps.
 */
import { DropdownMenu } from 'radix-ui';
import { useNavigate } from 'react-router';
import { Check, ChevronsUpDown, GraduationCap } from 'lucide-react';
import { useApp, useUserId } from '../app-context';
import { TARGETS, useTarget, type Target } from '../lib/exam-targets';
import type { Dict } from '../lib/i18n';

const FAMILIES: [Target['family'], keyof Dict][] = [
  ['delf', 'shellExamFamilyDelf'], ['dalf', 'shellExamFamilyDalf'], ['tcf', 'shellExamFamilyTcf'], ['canada', 'shellExamFamilyCanada'],
];

export function ExamSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useApp();
  const userId = useUserId();
  const [target, choose] = useTarget(userId);
  const navigate = useNavigate();
  const family = target ? FAMILIES.find(([f]) => f === target.family)?.[1] : null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="exsw" data-testid="exam-switcher" aria-label={t('shellExamSwitch')}>
          <span className="exsw__mark" aria-hidden="true"><GraduationCap className="size-4" /></span>
          <span className="exsw__text">
            <span className="exsw__title">{target ? target.label : t('shellExamChoose')}</span>
            {!compact && family && <span className="exsw__sub">{t(family)}</span>}
          </span>
          <ChevronsUpDown className="exsw__chev size-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="exsw-menu" align="start" sideOffset={6} collisionPadding={12}>
          {FAMILIES.map(([f, label], i) => (
            <DropdownMenu.Group key={f}>
              {i > 0 && <DropdownMenu.Separator className="exsw-menu__sep" />}
              <DropdownMenu.Label className="exsw-menu__label">{t(label)}</DropdownMenu.Label>
              {TARGETS.filter((x) => x.family === f).map((x) => (
                <DropdownMenu.Item key={x.id} className="exsw-menu__item" data-testid={`exam-option-${x.id}`}
                  onSelect={() => { choose(x.id); navigate(`/app/exam/${x.id}`); }}>
                  <span>{x.label}</span>
                  {target?.id === x.id && <Check className="size-4" aria-label={t('shellExamCurrent')} />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
