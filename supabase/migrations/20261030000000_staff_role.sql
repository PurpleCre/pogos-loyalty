-- Commit the enum extension before policies in the next migration use the value.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
