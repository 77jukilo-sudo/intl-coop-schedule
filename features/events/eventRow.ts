// 저장소의 일정 한 줄(snake_case)을 앱에서 쓰는 모양(camelCase, types/schedule.ts)으로 바꾼다.
import type {
  EventStatus,
  GeoCategory,
  ScheduleEvent,
  WorkCategory,
} from "../../types/schedule";

// 저장소(events 표)에서 읽어 오는 한 줄의 모양
export interface EventRow {
  id: string;
  group_id: string | null;
  option_no: number | null;
  title: string;
  start_date: string | null;
  end_date: string | null;
  date_note: string | null;
  start_time: string | null;
  end_time: string | null;
  is_overseas: boolean;
  city: string | null;
  country: string | null;
  location_note: string | null;
  lat: number | null;
  lng: number | null;
  assignee_id: string | null;
  status: string;
  geo_category: string;
  work_category: string;
  source_name: string;
  hidden_at: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// 저장소의 시간은 "09:00:00" 모양이라 "09:00"까지만 쓴다.
const toHourMinute = (time: string | null) => (time ? time.slice(0, 5) : null);

export function rowToEvent(row: EventRow): ScheduleEvent {
  return {
    id: row.id,
    groupId: row.group_id,
    optionNo: row.option_no,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    dateNote: row.date_note,
    startTime: toHourMinute(row.start_time),
    endTime: toHourMinute(row.end_time),
    isOverseas: row.is_overseas,
    city: row.city,
    country: row.country,
    locationNote: row.location_note,
    lat: row.lat,
    lng: row.lng,
    assigneeId: row.assignee_id,
    status: row.status as EventStatus,
    geoCategory: row.geo_category as GeoCategory,
    workCategory: row.work_category as WorkCategory,
    sourceName: row.source_name,
    hiddenAt: row.hidden_at,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
