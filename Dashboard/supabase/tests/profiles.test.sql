begin;

select plan(5);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'first@example.com'),
  ('00000000-0000-4000-8000-000000000002', 'second@example.com');

select is(
  (select count(*)::integer from public.profiles),
  2,
  'a profile is created for every auth user'
);

set local role anon;

select is(
  (select count(*)::integer from public.profiles),
  0,
  'anonymous users cannot read profiles'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'authenticated users can read only their own profile'
);

update public.profiles
set display_name = 'First User'
where id = '00000000-0000-4000-8000-000000000001';

select is(
  (
    select display_name
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000001'
  ),
  'First User',
  'authenticated users can update their own display name'
);

update public.profiles
set display_name = 'Not Allowed'
where id = '00000000-0000-4000-8000-000000000002';

reset role;

select is(
  (
    select display_name
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000002'
  ),
  null,
  'authenticated users cannot update another profile'
);

select * from finish();
rollback;
