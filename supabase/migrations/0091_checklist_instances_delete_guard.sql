-- Checklisten-Instanzen sollen vom Admin gelöscht werden können, aber
-- abgeschlossene (archivierte) Instanzen nie - unabhängig davon, ob die
-- Löschung über die UI oder direkt per API versucht wird. Insert/Update
-- bleiben unverändert admin-only wie bisher, delete bekommt eine eigene,
-- strengere Policy.

drop policy checklist_instances_write on checklist_instances;

create policy checklist_instances_insert on checklist_instances for insert
  with check (is_admin());

create policy checklist_instances_update on checklist_instances for update
  using (is_admin())
  with check (is_admin());

create policy checklist_instances_delete on checklist_instances for delete
  using (is_admin() and archived_at is null);
