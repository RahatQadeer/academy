-- Align academy_credentials.type with the program's recognition
-- (fixes endorsement programs that were queued as certificate_of_completion).

update public.academy_credentials c
set type = public.academy_credential_type_for_recognition(p.recognition)
from public.academy_programs p
where p.id = c.program_id
  and p.recognition is distinct from 'none'::public.academy_course_recognition
  and c.type is distinct from public.academy_credential_type_for_recognition(p.recognition);
