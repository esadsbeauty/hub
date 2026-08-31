      calendar_agenda_range:{Args:{range_start:string;range_end:string;responsible_filter?:string|null};Returns:Json};
      upsert_calendar_event:{Args:{event_data:Json;allow_conflict?:boolean};Returns:Json};
      set_calendar_event_status:{Args:{target_event_id:string;next_status:string};Returns:undefined};