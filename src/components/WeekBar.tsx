import React, { useMemo } from 'react';
import { formatDate } from '@/lib/calculations';

interface WeekBarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function WeekBar({ selectedDate, onSelectDate }: WeekBarProps) {
  const todayStr = formatDate(new Date());

  const weekDays = useMemo(() => {
    const selected = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = selected.getDay(); // 0=Sun
    const startOfWeek = new Date(selected);
    startOfWeek.setDate(selected.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return {
        dateStr: formatDate(d),
        dayNum: d.getDate(),
        dayLabel: DAY_LABELS[i],
      };
    });
  }, [selectedDate]);

  return (
    <div className="flex items-stretch justify-between gap-0 mb-3 border border-muted-foreground/30">
      {weekDays.map(({ dateStr, dayNum, dayLabel }) => {
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === todayStr;

        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onSelectDate(dateStr)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            <span className="font-heading text-[10px] uppercase tracking-wider">
              {dayLabel}
            </span>
            <span className={`text-base font-heading ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
              {dayNum}
            </span>
            <span className={`w-1 h-1 ${isToday ? (isSelected ? 'bg-primary-foreground' : 'bg-primary') : ''}`} />
          </button>
        );
      })}
    </div>
  );
}
