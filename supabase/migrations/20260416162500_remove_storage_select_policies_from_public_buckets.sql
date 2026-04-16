begin;

drop policy if exists "Public Access DevImages" on storage.objects;
drop policy if exists "Public Access Logos" on storage.objects;
drop policy if exists "Auth Read DevImages" on storage.objects;
drop policy if exists "Auth Read Logos" on storage.objects;

commit;
