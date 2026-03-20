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
    <div className="flex items-center justify-between gap-1 mb-3 overflow-x-auto scrollbar-hide">
      {weekDays.map(({ dateStr, dayNum, dayLabel }) => {
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === todayStr;

        return (
          <button
            key={dateStr}
            onClick={() => onSelectDate(dateStr)}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[2.75rem] rounded-xl transition-all font-body ${
              isSelected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-secondary text-muted-foreground'
            }`}
          >
            <span className={`text-[10px] uppercase tracking-wide ${isSelected ? 'font-semibold' : ''}`}>
              {dayLabel}
            </span>
            <span className={`text-sm font-heading ${isSelected ? 'font-bold' : 'font-medium'}`}>
              {dayNum}
            </span>
            {isToday && !isSelected && (
              <span className="w-1 h-1 rounded-full bg-primary" />
            )}
            {isToday && isSelected && (
              <span className="w-1 h-1 rounded-full bg-primary-foreground" />
            )}
            {!isToday && (
              <span className="w-1 h-1" />
            )}
          </button>
        );
      })}
    </div>
  );
}
