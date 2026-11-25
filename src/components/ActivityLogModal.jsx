import { formatDate } from '../utils/formatDate';
import { MemberTag, ModalFrame } from './roomUi';

export default function ActivityLogModal({ activity, onClose }) {
  return (
    <ModalFrame
      titleId="activity-log-title"
      title="Room activity"
      onClose={onClose}
      closeLabel="Close activity"
      panelClassName="sm:max-w-xl"
    >
      <div className="mt-4 max-h-[60vh] overflow-y-auto">
        {activity.length ? (
          <ol className="divide-y divide-[#e2e8f0]">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3 first:pt-0">
                <MemberTag name={entry.actor || 'Unknown'} colors={{}} small />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0f172a]">{entry.action}</p>
                  <p className="mt-0.5 break-words text-sm text-[#475569]">{entry.description}</p>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-[#64748b]">
                  {formatDate(entry.datetime) || '—'}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-8 text-center text-sm text-[#64748b]">No activity yet.</p>
        )}
      </div>
    </ModalFrame>
  );
}
