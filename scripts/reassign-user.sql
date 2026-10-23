-- One-off recovery for data saved before the sign-in fix, when each login got a new random user id.
-- ONLY safe if you are the only person who has used the app (it moves ALL rows to one account).
-- 1) Sign in again, open Settings > Account, copy your Account ID.
-- 2) Replace PASTE_ACCOUNT_ID_HERE below (keep the quotes), then run in the Neon SQL editor.
BEGIN;
UPDATE assets       SET user_id = 'PASTE_ACCOUNT_ID_HERE' WHERE user_id <> 'PASTE_ACCOUNT_ID_HERE';
UPDATE buy_lots     SET user_id = 'PASTE_ACCOUNT_ID_HERE' WHERE user_id <> 'PASTE_ACCOUNT_ID_HERE';
UPDATE sales        SET user_id = 'PASTE_ACCOUNT_ID_HERE' WHERE user_id <> 'PASTE_ACCOUNT_ID_HERE';
UPDATE misc_entries SET user_id = 'PASTE_ACCOUNT_ID_HERE' WHERE user_id <> 'PASTE_ACCOUNT_ID_HERE';
-- Only your slab-rate setting lives here; stale rows are dropped (re-set it in Settings if needed).
DELETE FROM user_settings WHERE user_id <> 'PASTE_ACCOUNT_ID_HERE';
COMMIT;
