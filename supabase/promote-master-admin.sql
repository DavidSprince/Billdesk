-- Optional: after signing up with the app, promote yourself.
-- Sign up normally (you'll join as a Member), then run:
update public.profiles
set role = 'master_admin', theme = 'golden'
where email = 'you@yourcompany.com';   -- ← change to your email
