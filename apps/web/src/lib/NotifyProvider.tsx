import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { NotifyCtx, readSeen, writeSeen, type NotifySection } from "./notifyCtx";
import { pb } from "./pocketbase";
import { lastSemesterSlug } from "./lastSemester";
import { useAuth } from "../hooks/useAuth";
import { fetchRosterPeople, groupInitials } from "../services/groupApi";
import { Icon } from "../ui";

interface Item {
  created: string;
}
interface Summary {
  requests: Item[];
  shares: Item[];
  subgroups: Item[];
}

interface Msg {
  id: number;
  initials: string;
  who: string;
  text: string;
  action: string;
  to: string;
}

const TOAST_MS = 6000;
const POLL_MS = 60_000;

const after = (created: string, seen: string) => !seen || created.replace(" ", "T") > seen;

/**
 * Уведомления группы без списка (Screen-notifications): точка, сообщение на 6 секунд и значок «Новое».
 * Точка считается по данным сервера («что случилось после того, как ты смотрел»), поэтому её видит и тот,
 * кто был не в сети. Сообщения о событиях «в реальном времени» показываются только пока человек в приложении.
 */
export default function NotifyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary>({ requests: [], shares: [], subgroups: [] });
  const [tick, setTick] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const seq = useRef(0);
  const names = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const s = await pb.send<Summary>("/api/group/notifications", { method: "GET", query: { since: "1970-01-01T00:00:00Z" } });
      setSummary({ requests: s.requests ?? [], shares: s.shares ?? [], subgroups: s.subgroups ?? [] });
    } catch {
      /* нет связи — точка останется прежней */
    }
  }, [me]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const push = useCallback((m: Omit<Msg, "id">) => {
    const id = (seq.current += 1);
    setMsgs((cur) => [...cur.slice(-2), { ...m, id }]);
    window.setTimeout(() => setMsgs((cur) => cur.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  const personName = useCallback(async (userId: string, groupId: string): Promise<string> => {
    if (names.current[userId]) return names.current[userId];
    try {
      for (const p of await fetchRosterPeople(groupId)) names.current[p.id] = p.name;
    } catch {
      /* имя не нашлось — покажем нейтральное */
    }
    return names.current[userId] ?? "Участник";
  }, []);

  // Сообщения в реальном времени: запрос доступа, доступ открыт и закрыт.
  useEffect(() => {
    if (!me) return;
    const sem = lastSemesterSlug() || "1";
    const unsubs: (() => void)[] = [];
    void pb.collection("access_requests").subscribe("*", async (e) => {
      const r = e.record as unknown as { owner: string; requester: string; lecture: string; group: string; status: string };
      if (e.action !== "create" || r.owner !== me || r.status !== "open") return;
      const who = await personName(r.requester, r.group);
      let title = "лекции";
      try {
        title = String((await pb.collection("lectures").getOne(r.lecture, { fields: "title" })).title);
      } catch {
        /* лекция недоступна — общий текст */
      }
      push({ initials: groupInitials(who), who, text: `запрос доступа к «${title}»`, action: "Ответить", to: `/s/${sem}/group/access` });
      void load();
    }).then((u) => unsubs.push(u));
    void pb.collection("lecture_shares").subscribe("*", async (e) => {
      const r = e.record as unknown as { owner: string; grantee: string; lecture: string; group: string };
      if (r.grantee !== me) return;
      const who = await personName(r.owner, r.group);
      if (e.action === "create") {
        let title = "лекции";
        try {
          title = String((await pb.collection("lectures").getOne(r.lecture, { fields: "title" })).title);
        } catch {
          /* ещё не видна */
        }
        push({ initials: groupInitials(who), who, text: `открыт доступ к «${title}»`, action: "Открыть", to: `/s/${sem}/group/lecture/${r.lecture}` });
        void load();
      } else if (e.action === "delete") {
        // след в базе не остаётся: сообщение видно только пока человек в сети
        push({ initials: groupInitials(who), who, text: "закрыт доступ к лекции", action: "Понятно", to: "" });
      }
    }).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, [me, personName, push, load]);

  const dots = useMemo(() => {
    void tick;
    return {
      group: summary.requests.some((x) => after(x.created, readSeen("group"))) || summary.shares.some((x) => after(x.created, readSeen("group"))) || summary.subgroups.some((x) => after(x.created, readSeen("group"))),
      access: summary.requests.some((x) => after(x.created, readSeen("access"))) || summary.shares.some((x) => after(x.created, readSeen("access"))),
      exams: summary.subgroups.some((x) => after(x.created, readSeen("exams"))),
    };
  }, [summary, tick]);

  const markSeen = useCallback((section: NotifySection) => {
    const now = new Date().toISOString();
    writeSeen(section, now);
    // «group» гасит точку на «Группа»; разделы внутри группы гасятся отдельно
    if (section === "access" || section === "exams") writeSeen("group", now);
    setTick((t) => t + 1);
  }, []);

  const value = useMemo(() => ({ dots, markSeen }), [dots, markSeen]);

  return (
    <NotifyCtx.Provider value={value}>
      {children}
      <div className="c-gr-toasts" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className="c-gr-toast" role="status">
            <span className="av">{m.initials}</span>
            <span className="tx">
              <b>{m.who}</b>: {m.text}
            </span>
            <button
              type="button"
              className="act"
              onClick={() => {
                setMsgs((cur) => cur.filter((x) => x.id !== m.id));
                if (m.to) navigate(m.to);
              }}
            >
              {m.action}
            </button>
            <button type="button" className="x" aria-label="Закрыть" onClick={() => setMsgs((cur) => cur.filter((x) => x.id !== m.id))}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotifyCtx.Provider>
  );
}
