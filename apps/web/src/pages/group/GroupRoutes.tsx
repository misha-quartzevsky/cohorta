import { useEffect } from "react";
import { GroupGate } from "../../components/group/common";
import { useMode } from "../../lib/modeContext";
import GroupAccessPage from "./GroupAccessPage";
import GroupCreatePage from "./GroupCreatePage";
import GroupHomePage from "./GroupHomePage";
import GroupLecturePage from "./GroupLecturePage";
import GroupJoinPage from "./GroupJoinPage";
import { GroupMemberPage, GroupMemberSubjectPage } from "./GroupMemberPages";
import GroupSettingsPage from "./GroupSettingsPage";
import GroupExamsPage from "./GroupExamsPage";
import GroupExamPage from "./GroupExamPage";
import GroupTicketPage from "./GroupTicketPage";

/** Обёртки адресов группы: открытие любого из них включает режим «Группа», человеку без группы — «Вступи в свою группу». */
export const GroupHomeRoute = () => (
  <GroupGate>
    <GroupHomePage />
  </GroupGate>
);
export const GroupAccessRoute = () => (
  <GroupGate>
    <GroupAccessPage />
  </GroupGate>
);
export const GroupSettingsRoute = () => (
  <GroupGate>
    <GroupSettingsPage />
  </GroupGate>
);
export const GroupMemberRoute = () => (
  <GroupGate>
    <GroupMemberPage />
  </GroupGate>
);
export const GroupMemberSubjectRoute = () => (
  <GroupGate>
    <GroupMemberSubjectPage />
  </GroupGate>
);
export const GroupLectureRoute = () => (
  <GroupGate>
    <GroupLecturePage />
  </GroupGate>
);
export const GroupExamsRoute = () => (
  <GroupGate>
    <GroupExamsPage />
  </GroupGate>
);
export const GroupExamRoute = () => (
  <GroupGate>
    <GroupExamPage />
  </GroupGate>
);
/** Билет подгруппы режим не переключает: вне режима «Группа» он открывается в защищённом просмотре. */
export const GroupTicketRoute = () => <GroupTicketPage />;
export function GroupJoinRoute() {
  const { setMode } = useMode();
  useEffect(() => setMode("group"), [setMode]);
  return <GroupJoinPage />;
}
export { GroupCreatePage };
