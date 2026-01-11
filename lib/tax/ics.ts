export type IcsEventInput = {
    title: string;
    description?: string;
    location?: string;
    // local date/time, interpreted in the user's current tz by the calendar app
    startLocal: Date;
    durationMinutes?: number;
  };
  
  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }
  
  // Produces a floating (non-Z) DTSTART so calendar apps place it in local time.
  function formatLocal(dt: Date) {
    const y = dt.getFullYear();
    const m = pad2(dt.getMonth() + 1);
    const d = pad2(dt.getDate());
    const hh = pad2(dt.getHours());
    const mm = pad2(dt.getMinutes());
    const ss = "00";
    return `${y}${m}${d}T${hh}${mm}${ss}`;
  }
  
  function escapeText(s: string) {
    return s
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  }
  
  export function buildIcs(evt: IcsEventInput) {
    const dtstamp = formatLocal(new Date());
    const dtstart = formatLocal(evt.startLocal);
    const dur = Math.max(5, evt.durationMinutes ?? 30);
    const dtend = formatLocal(new Date(evt.startLocal.getTime() + dur * 60_000));
  
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BTBB//Tax Planning//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@btbb`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${escapeText(evt.title)}`,
      evt.description ? `DESCRIPTION:${escapeText(evt.description)}` : "",
      evt.location ? `LOCATION:${escapeText(evt.location)}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean);
  
    return lines.join("\r\n");
  }
  
  export function downloadTextFile(filename: string, contents: string, mime = "text/plain") {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  