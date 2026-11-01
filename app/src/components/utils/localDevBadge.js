import { isCloudClient, isLocalDevSession } from '../../config/cloudClient.js';

const { Row } = Liteframe;

const BADGE_CLASS =
  'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex-shrink-0';

/** Amber pill shown only during `npm run dev:cloud` (Vite DEV), not in installed builds. */
export function LocalDevBadge() {
  if (!isCloudClient() || !isLocalDevSession()) return null;
  return Row(
    {
      tagType: 'span',
      class: BADGE_CLASS,
      attributes: { title: 'Vite dev session — not the installed app' }
    },
    'Local dev'
  );
}
