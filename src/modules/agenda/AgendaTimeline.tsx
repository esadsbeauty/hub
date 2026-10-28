import type { AgendaEvent } from "./types";
import { agendaTypeLabels } from "./types";

const START_HOUR = 0;
const END_HOUR = 24;
const PIXELS_PER_HOUR = 58;
const DAY_MINUTES = 1440;

const kinds: Record<string, string> = {
  meeting: "border-blue-300 bg-blue-50 text-blue-950",
  follow_up: "border-amber-300 bg-amber-50 text-amber-950",
  call: "border-violet-300 bg-violet-50 text-violet-950",
  focus_block: "border-emerald-300 bg-emerald-50 text-emerald-950",
  personal: "border-slate-300 bg-slate-50 text-slate-900",
};

function minutes(iso: string, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function localDate(iso: string, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

type Positioned = { event: AgendaEvent; start: number; end: number; lane: number; lanes: number };
function positionEvents(events: AgendaEvent[], timezone: string): Positioned[] {
  const segments = events.map((event) => {
    const start = minutes(event.startAt, timezone);
    const crossesDay = localDate(event.endAt, timezone) !== localDate(event.startAt, timezone);
    const end = crossesDay ? DAY_MINUTES : minutes(event.endAt, timezone);
    return { event, start, end: Math.max(start + 1, end), lane: 0, lanes: 1 };
  }).sort((a,b) => a.start - b.start || a.end - b.end);
  let group: typeof segments = [];
  let latestEnd = -1;
  const finalize = () => {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    for (const item of group) item.lanes = lanes;
  };
  for (const item of segments) {
    if (group.length && item.start >= latestEnd) {
      finalize(); group = []; latestEnd = -1;
    }
    const used = new Set(group.filter((other) => other.end > item.start).map((other) => other.lane));
    while (used.has(item.lane)) item.lane++;
    group.push(item);
    latestEnd = Math.max(latestEnd, item.end);
  }
  if (group.length) finalize();
  return segments;
}

export function AgendaTimeline({events, timezone, onOpen}:{
  events: AgendaEvent[]; timezone: string; onOpen: (event: AgendaEvent) => void;
}) {
  const positioned = positionEvents(events, timezone);
  const height = (END_HOUR - START_HOUR) * PIXELS_PER_HOUR;
  return <div className="relative overflow-y-auto rounded-2xl border bg-card" style={{maxHeight: "min(72vh, 880px)"}}>
    <div className="relative" style={{height}}>
      {Array.from({length: END_HOUR - START_HOUR + 1}, (_,i) =>
        <div key={i} className="absolute inset-x-0 border-t border-border/70" style={{top:i*PIXELS_PER_HOUR}}>
          <span className="absolute left-2 -translate-y-1/2 bg-card pr-2 text-xs text-muted-foreground">{String(START_HOUR+i).padStart(2,"0")}:00</span>
        </div>
      )}
      <div className="absolute inset-y-0 left-14 right-2">
        {positioned.map(({event,start,end,lane,lanes}) => {
          const top = ((start - START_HOUR*60)/60)*PIXELS_PER_HOUR;
          const blockHeight = Math.max(25, ((end-start)/60)*PIXELS_PER_HOUR);
          return <button
            key={`${event.source}-${event.id}-${event.startAt}`}
            onClick={() => onOpen(event)}
            title={`${event.title} — ${agendaTypeLabels[event.type]}`}
            className={`absolute overflow-hidden rounded-lg border px-2 py-1 text-left shadow-sm premium-focus ${kinds[event.type] ?? "border-border bg-secondary text-foreground"}`}
            style={{top, height:blockHeight, left:`calc(${(lane/lanes)*100}% + 2px)`, width:`calc(${100/lanes}% - 4px)`}}
          >
            <b className="block truncate text-xs">{event.title}</b>
            {blockHeight >= 45 && <span className="block truncate text-xs opacity-75">{agendaTypeLabels[event.type]}</span>}
          </button>;
        })}
      </div>
    </div>
  </div>;
}
