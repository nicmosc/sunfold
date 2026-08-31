import { OptionRow, Sheet } from '@/components/ui/sheet';
import { formatRelativeDay, formatTime } from '@/lib/format';
import type { Location } from '@/lib/types';

/**
 * Days offered relative to today. Yesterday is included because "what did the
 * light do this morning" is a real question when reviewing a shoot; a week
 * ahead covers planning one.
 */
const DAY_OFFSETS = [-1, 0, 1, 2, 3, 4, 5, 6] as const;

export interface DayPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Currently selected offset from today. */
  dayOffset: number;
  onSelect: (offset: number) => void;
  location: Location;
  hour12: boolean;
  /** Minute-truncated clock, so rows are stable between renders. */
  now: Date;
  /** Resolves that day's sunrise and sunset for the row's detail line. */
  getDayTimes: (date: Date) => { sunrise: Date | null; sunset: Date | null };
}

/**
 * Day selector. Each row carries that day's own sunrise and sunset, so the
 * picker doubles as a week-at-a-glance — looking a few days out is usually
 * about seeing how the light is shifting, not just changing a label.
 */
export function DayPickerSheet({
  visible,
  onClose,
  dayOffset,
  onSelect,
  location,
  hour12,
  now,
  getDayTimes,
}: DayPickerSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose a day">
      {DAY_OFFSETS.map((offset) => {
        const date = new Date(now);
        date.setDate(date.getDate() + offset);

        const { sunrise, sunset } = getDayTimes(date);
        const rise = formatTime(sunrise, location.timeZone, hour12);
        const set = formatTime(sunset, location.timeZone, hour12);

        return (
          <OptionRow
            key={offset}
            label={formatRelativeDay(date, location.timeZone, now)}
            detail={`${rise.time} ${rise.period} – ${set.time} ${set.period}`.replace(/\s+/g, ' ')}
            selected={offset === dayOffset}
            onPress={() => onSelect(offset)}
          />
        );
      })}
    </Sheet>
  );
}
