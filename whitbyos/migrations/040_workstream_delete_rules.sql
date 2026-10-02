-- Replacing a Work Plan's Work Streams was silently doing nothing.
--
-- WP.11/WP.14's "Ask Whitby" refinement deletes the plan's Work Streams and
-- writes the new ones. Three foreign keys pointing at whitbyos_workstreams
-- carried no ON DELETE clause, which in Postgres means NO ACTION: the delete
-- raised a foreign key violation instead of removing anything. The caller did
-- not read the error, so every refinement appended a whole fresh copy of the
-- plan. Four Work Streams became nine, then fourteen.
--
-- whitbyos_considerations was the one that fired first, because drafting a plan
-- always writes considerations against its streams. The other two were waiting:
-- a decision recorded on a stream, and the far side of a dependency between two
-- of them - which is to say, the moment anybody used the feature.
--
-- What each one should do when its Work Stream goes:
--
--   considerations  set null. A note about a Work Stream that no longer exists
--                   is still a note about this plan. §6.4 keeps dismissed and
--                   resolved ones as a record of a decision somebody made, and
--                   that record must outlive the stream it was made against.
--   decisions       set null, for the same reason and more strongly: a decision
--                   is the record.
--   dependencies    cascade. A dependency whose other end is gone says nothing,
--                   and the same table's own workstream_id already cascades.

alter table public.whitbyos_considerations
  drop constraint if exists whitbyos_considerations_workstream_id_fkey,
  add constraint whitbyos_considerations_workstream_id_fkey
    foreign key (workstream_id) references public.whitbyos_workstreams(id)
    on delete set null;

alter table public.whitbyos_decisions
  drop constraint if exists whitbyos_decisions_workstream_id_fkey,
  add constraint whitbyos_decisions_workstream_id_fkey
    foreign key (workstream_id) references public.whitbyos_workstreams(id)
    on delete set null;

alter table public.whitbyos_workstream_dependencies
  drop constraint if exists whitbyos_workstream_dependencies_depends_on_workstream_id_fkey,
  add constraint whitbyos_workstream_dependencies_depends_on_workstream_id_fkey
    foreign key (depends_on_workstream_id) references public.whitbyos_workstreams(id)
    on delete cascade;
