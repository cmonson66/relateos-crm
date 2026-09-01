-- ===========================================================================
-- Pitch decks: a rep's presentation, on a link.
--
-- Same trust model as /agreement, /setup, /start and /review - the token in
-- the URL is the credential and the table stays closed behind a security
-- definer function. A deck is meant to be forwarded to a business partner, so
-- link-based access is the point rather than a compromise.
--
-- The deck body is jsonb rather than columns. What a deck contains is the
-- thing most likely to change every week, and a schema migration per idea is
-- how a tool like this dies.
-- ===========================================================================

create table if not exists pitch_decks (
  token       text primary key,
  account_ids uuid[] not null default '{}',
  deck        jsonb not null,
  created_by  uuid,
  active      boolean not null default true,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  opened_at   timestamptz,
  open_count  int not null default 0
);

alter table pitch_decks enable row level security;

-- Any signed-in rep may build and edit decks; there is nothing in one that is
-- not already said out loud in a merchant's dining room. The function has to
-- exist before the policy that calls it.
create or replace function pitch_deck_writer() returns boolean
language sql stable as $$ select auth.uid() is not null $$;

drop policy if exists pitch_decks_rw on pitch_decks;
create policy pitch_decks_rw on pitch_decks
  for all to authenticated
  using (pitch_deck_writer()) with check (pitch_deck_writer());

/**
 * Load a deck and record that it was opened, so a rep can see whether the
 * owner actually looked at it after the meeting.
 */
create or replace function pitch_load(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare d pitch_decks;
begin
  select * into d from pitch_decks
  where token = p_token and active and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  update pitch_decks
     set opened_at = now(), open_count = open_count + 1
   where token = p_token;

  return d.deck;
end $$;

grant execute on function pitch_load(text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- Manuel's Mexican Restaurant & Cantina - all eight rooms.
--
-- Crypto density is 47 ATMs verified on Google Places, with straight-line
-- distance computed from each store address. The Indian School and Shea
-- coordinates in `accounts` are identical and therefore wrong for at least one
-- of them; the deck carries corrected coordinates so the map does not stack
-- two pins. Fix the accounts rows separately.
-- --------------------------------------------------------------------------
insert into pitch_decks (token, account_ids, deck, expires_at) values (
  'HasZmJWicaPghmQ6EqnRtvrT',
  array[
    '463a4f08-54d1-46a7-9c11-b6dbd2ae65ad','853c730f-e417-4352-a11a-32c0c9e020ec',
    'e874c357-c683-43d9-bb0c-3bc59696b407','4ee90a62-6107-4de4-909b-76ce21243f7a',
    '5fc3f173-b3f1-46da-ba7d-091ce828e890','1a1785e1-4539-4ca5-855f-02a5175287d1',
    'f130326d-a915-4b7f-8dc7-71b3191823b4','02a244cd-2266-400d-9605-063d7ad63ac1'
  ]::uuid[],
  '{"brand": "Manuel''s Mexican Restaurant & Cantina", "subtitle": "Eight rooms across the valley, one payment lane that is closed in all of them.", "rep": "Chad Monson", "rep_phone": null, "locations": [{"label": "Indian School", "city": "Phoenix", "addr": "2820 E Indian School Rd", "lat": 33.495, "lng": -112.023, "atm_1600": 0, "atm_5000": 5, "nearest_m": 1738, "nearest_name": "Athena", "near": [{"n": "Athena", "a": "1949 E Osborn Rd, Phoenix", "lat": 33.4872657, "lng": -112.0392879, "m": 1738}, {"n": "Cryptobase", "a": "3345 N 16th St, Phoenix", "lat": 33.4871371, "lng": -112.047148, "m": 2404}, {"n": "Cryptobase", "a": "4249 E Thomas Rd, Phoenix", "lat": 33.4800908, "lng": -111.9893707, "m": 3532}, {"n": "Unbank - 9 Vape & Smoke", "a": "635 E Indian School Rd, Phoenix", "lat": 33.4943046, "lng": -112.0654055, "m": 3933}, {"n": "RockItCoin", "a": "702 E Virginia Ave, Phoenix", "lat": 33.4768985, "lng": -112.0647624, "m": 4365}, {"n": "CoinFlip - Buzz In Buzz Out", "a": "1501 W Indian School Rd, Phoenix", "lat": 33.4947027, "lng": -112.0916969, "m": 6370}]}, {"label": "Shea", "city": "Phoenix", "addr": "3131 E Shea Blvd", "lat": 33.5822, "lng": -112.0141, "atm_1600": 1, "atm_5000": 1, "nearest_m": 89, "nearest_name": "LibertyX - Walgreens", "near": [{"n": "LibertyX - Walgreens", "a": "10602 N 32nd St, Phoenix", "lat": 33.5828586, "lng": -112.0135465, "m": 89}, {"n": "CoinFlip - Cobblestone Auto Spa", "a": "3739 E Bell Rd, Phoenix", "lat": 33.6399786, "lng": -112.0010056, "m": 6538}]}, {"label": "Bell Rd", "city": "Phoenix", "addr": "1111 W Bell Rd", "lat": 33.6396823, "lng": -112.0877682, "atm_1600": 2, "atm_5000": 5, "nearest_m": 1142, "nearest_name": "Digital Cash 2 Go", "near": [{"n": "Digital Cash 2 Go", "a": "1902 W Bell Rd, Phoenix", "lat": 33.6405563, "lng": -112.1000581, "m": 1142}, {"n": "Coin Time", "a": "1902 W Bell Rd, Phoenix", "lat": 33.6404912, "lng": -112.100178, "m": 1152}, {"n": "CoinFlip - Craft Beer Hop Stop", "a": "717 W Union Hills Dr, Phoenix", "lat": 33.6538958, "lng": -112.0833521, "m": 1632}, {"n": "CoinFlip - Sams Mini", "a": "18440 N 7th St, Phoenix", "lat": 33.6541659, "lng": -112.0667794, "m": 2524}, {"n": "CoinFlip - Greenway Liquor", "a": "3502 W Greenway Rd, Phoenix", "lat": 33.6255504, "lng": -112.1339396, "m": 4554}]}, {"label": "Glendale", "city": "Glendale", "addr": "5670 W Peoria Ave", "lat": 33.5822875, "lng": -112.1808285, "atm_1600": 1, "atm_5000": 4, "nearest_m": 1080, "nearest_name": "CoinFlip - Chevron", "near": [{"n": "CoinFlip - Chevron", "a": "5103 W Peoria Ave, Glendale", "lat": 33.5814251, "lng": -112.1692109, "m": 1080}, {"n": "Coinhub", "a": "10222 N 43rd Ave, Glendale", "lat": 33.5791344, "lng": -112.1527553, "m": 2624}, {"n": "GetCoins", "a": "13810 N 51st Ave, Glendale", "lat": 33.6111113, "lng": -112.1704231, "m": 3347}, {"n": "CoinFlip - Top Shelf Smoke", "a": "5923 W Glendale Ave, Glendale", "lat": 33.5383881, "lng": -112.1872561, "m": 4918}, {"n": "CoinFlip - Bell Tower Market", "a": "6302 W Bell Rd, Glendale", "lat": 33.6392425, "lng": -112.1954234, "m": 6476}, {"n": "CoinFlip - Greenway Liquor", "a": "3502 W Greenway Rd, Phoenix", "lat": 33.6255504, "lng": -112.1339396, "m": 6481}]}, {"label": "Goodyear", "city": "Goodyear", "addr": "13319 W McDowell Rd", "lat": 33.463093, "lng": -112.345734, "atm_1600": 4, "atm_5000": 7, "nearest_m": 149, "nearest_name": "RockItCoin", "near": [{"n": "RockItCoin", "a": "13375 W McDowell Rd, Goodyear", "lat": 33.4633611, "lng": -112.3473051, "m": 149}, {"n": "LibertyX - Target", "a": "1515 N Litchfield Rd, Goodyear", "lat": 33.4632546, "lng": -112.3550121, "m": 861}, {"n": "CoinFlip - Toke N'' Smoke", "a": "13370 W Van Buren St, Goodyear", "lat": 33.4503392, "lng": -112.3470591, "m": 1423}, {"n": "Bitstop", "a": "13310 W Van Buren St, Goodyear", "lat": 33.4502456, "lng": -112.345689, "m": 1429}, {"n": "LibertyX - CVS", "a": "2840 N Dysart Rd, Goodyear", "lat": 33.4781485, "lng": -112.3418113, "m": 1713}, {"n": "LibertyX - Top Notch Barbershop", "a": "213 N Litchfield Rd, Goodyear", "lat": 33.4483616, "lng": -112.3571137, "m": 1949}]}, {"label": "Scottsdale", "city": "Scottsdale", "addr": "8809 E Mountain View Rd", "lat": 33.5750298, "lng": -111.888244, "atm_1600": 0, "atm_5000": 1, "nearest_m": 4503, "nearest_name": "Coinhub", "near": [{"n": "Coinhub", "a": "6987 Hayden Rd, Scottsdale", "lat": 33.5380264, "lng": -111.9080009, "m": 4503}, {"n": "Coinstar - Albertsons", "a": "11475 E Via Linda, Scottsdale", "lat": 33.5890355, "lng": -111.833849, "m": 5274}]}, {"label": "Tempe", "city": "Tempe", "addr": "2350 E Southern Ave", "lat": 33.3934534, "lng": -111.8881474, "atm_1600": 1, "atm_5000": 1, "nearest_m": 965, "nearest_name": "CoinFlip - Bad Habits", "near": [{"n": "CoinFlip - Bad Habits", "a": "2044 E Southern Ave, Tempe", "lat": 33.393336, "lng": -111.8985456, "m": 965}, {"n": "Coinhub", "a": "1405 N Scottsdale Rd, Tempe", "lat": 33.4444434, "lng": -111.9259546, "m": 6668}, {"n": "GetCoins", "a": "393 W Warner Rd, Chandler", "lat": 33.3343128, "lng": -111.8463669, "m": 7636}]}, {"label": "Chandler", "city": "Chandler", "addr": "4210 S Arizona Ave", "lat": 33.2455817, "lng": -111.8425772, "atm_1600": 2, "atm_5000": 3, "nearest_m": 1318, "nearest_name": "LibertyX - CVS", "near": [{"n": "LibertyX - CVS", "a": "4990 S Arizona Ave, Chandler", "lat": 33.2337263, "lng": -111.8423233, "m": 1318}, {"n": "LibertyX", "a": "5050 S Arizona Ave, Chandler", "lat": 33.2323947, "lng": -111.842203, "m": 1467}, {"n": "Coinstar - Albertsons", "a": "3145 S Alma School Rd, Chandler", "lat": 33.2606668, "lng": -111.8570449, "m": 2150}, {"n": "Bitstop", "a": "629 E Chandler Blvd, Chandler", "lat": 33.3057105, "lng": -111.8315834, "m": 6764}, {"n": "RockItCoin", "a": "500 E Chandler Blvd, Chandler", "lat": 33.3063472, "lng": -111.8339654, "m": 6804}, {"n": "Athena", "a": "545 N Arizona Ave, Chandler", "lat": 33.3124597, "lng": -111.8411315, "m": 7438}]}], "atms": [{"n": "Unbank - 9 Vape & Smoke", "a": "635 E Indian School Rd, Phoenix", "lat": 33.4943046, "lng": -112.0654055}, {"n": "Cryptobase", "a": "5402 W Indian School Rd, Phoenix", "lat": 33.4953266, "lng": -112.1755994}, {"n": "Cryptobase", "a": "3345 N 16th St, Phoenix", "lat": 33.4871371, "lng": -112.047148}, {"n": "CoinFlip - Cobblestone Auto Spa", "a": "3739 E Bell Rd, Phoenix", "lat": 33.6399786, "lng": -112.0010056}, {"n": "Athena", "a": "1949 E Osborn Rd, Phoenix", "lat": 33.4872657, "lng": -112.0392879}, {"n": "Cryptobase", "a": "4249 E Thomas Rd, Phoenix", "lat": 33.4800908, "lng": -111.9893707}, {"n": "CoinFlip - Buzz In Buzz Out", "a": "1501 W Indian School Rd, Phoenix", "lat": 33.4947027, "lng": -112.0916969}, {"n": "RockItCoin", "a": "702 E Virginia Ave, Phoenix", "lat": 33.4768985, "lng": -112.0647624}, {"n": "Bitstop", "a": "629 E Chandler Blvd, Chandler", "lat": 33.3057105, "lng": -111.8315834}, {"n": "LibertyX - CVS", "a": "4990 S Arizona Ave, Chandler", "lat": 33.2337263, "lng": -111.8423233}, {"n": "Athena", "a": "545 N Arizona Ave, Chandler", "lat": 33.3124597, "lng": -111.8411315}, {"n": "LibertyX", "a": "5050 S Arizona Ave, Chandler", "lat": 33.2323947, "lng": -111.842203}, {"n": "GetCoins", "a": "393 W Warner Rd, Chandler", "lat": 33.3343128, "lng": -111.8463669}, {"n": "Coinstar - Albertsons", "a": "3145 S Alma School Rd, Chandler", "lat": 33.2606668, "lng": -111.8570449}, {"n": "RockItCoin", "a": "500 E Chandler Blvd, Chandler", "lat": 33.3063472, "lng": -111.8339654}, {"n": "Athena", "a": "554 N Arizona Ave, Chandler", "lat": 33.3126535, "lng": -111.8418832}, {"n": "CoinFlip - Chevron", "a": "5103 W Peoria Ave, Glendale", "lat": 33.5814251, "lng": -112.1692109}, {"n": "GetCoins", "a": "13810 N 51st Ave, Glendale", "lat": 33.6111113, "lng": -112.1704231}, {"n": "CoinFlip - Bell Tower Market", "a": "6302 W Bell Rd, Glendale", "lat": 33.6392425, "lng": -112.1954234}, {"n": "Coinhub", "a": "10222 N 43rd Ave, Glendale", "lat": 33.5791344, "lng": -112.1527553}, {"n": "CoinFlip - Top Shelf Smoke", "a": "5923 W Glendale Ave, Glendale", "lat": 33.5383881, "lng": -112.1872561}, {"n": "CoinFlip - Sunburst Smoke", "a": "20851 N 83rd Ave, Peoria", "lat": 33.6733683, "lng": -112.238262}, {"n": "RockItCoin", "a": "8110 W Union Hills Dr, Glendale", "lat": 33.65394, "lng": -112.2336421}, {"n": "RockItCoin", "a": "13375 W McDowell Rd, Goodyear", "lat": 33.4633611, "lng": -112.3473051}, {"n": "CoinFlip - Toke N'' Smoke", "a": "13370 W Van Buren St, Goodyear", "lat": 33.4503392, "lng": -112.3470591}, {"n": "LibertyX - Target", "a": "1515 N Litchfield Rd, Goodyear", "lat": 33.4632546, "lng": -112.3550121}, {"n": "Bitstop", "a": "13310 W Van Buren St, Goodyear", "lat": 33.4502456, "lng": -112.345689}, {"n": "CoinFlip - V. World Smoke", "a": "960 S Sarival Ave, Goodyear", "lat": 33.4377294, "lng": -112.4101009}, {"n": "Bitbox", "a": "15557 W Roosevelt St, Goodyear", "lat": 33.45696, "lng": -112.3933966}, {"n": "LibertyX - CVS", "a": "2840 N Dysart Rd, Goodyear", "lat": 33.4781485, "lng": -112.3418113}, {"n": "LibertyX - Top Notch Barbershop", "a": "213 N Litchfield Rd, Goodyear", "lat": 33.4483616, "lng": -112.3571137}, {"n": "CoinFlip - Your Smoke Shop 2", "a": "21811 N Scottsdale Rd, Scottsdale", "lat": 33.6852648, "lng": -111.9245764}, {"n": "CoinFlip - Mojo Smoke Palace", "a": "8402 E Indian School Rd, Scottsdale", "lat": 33.4952756, "lng": -111.9000525}, {"n": "Coinstar", "a": "32551 N Scottsdale Rd, Scottsdale", "lat": 33.7811077, "lng": -111.9223116}, {"n": "Coinhub", "a": "6987 Hayden Rd, Scottsdale", "lat": 33.5380264, "lng": -111.9080009}, {"n": "Coinstar - Albertsons", "a": "11475 E Via Linda, Scottsdale", "lat": 33.5890355, "lng": -111.833849}, {"n": "Coinhub", "a": "1405 N Scottsdale Rd, Tempe", "lat": 33.4444434, "lng": -111.9259546}, {"n": "Coinhub", "a": "8322 E McDowell Rd, Scottsdale", "lat": 33.4663389, "lng": -111.9019672}, {"n": "Coinhub", "a": "7054 E 5th Ave, Scottsdale", "lat": 33.4981137, "lng": -111.9293216}, {"n": "CoinFlip - Bad Habits", "a": "2044 E Southern Ave, Tempe", "lat": 33.393336, "lng": -111.8985456}, {"n": "Coin Time", "a": "1902 W Bell Rd, Phoenix", "lat": 33.6404912, "lng": -112.100178}, {"n": "Digital Cash 2 Go", "a": "1902 W Bell Rd, Phoenix", "lat": 33.6405563, "lng": -112.1000581}, {"n": "CoinFlip - Craft Beer Hop Stop", "a": "717 W Union Hills Dr, Phoenix", "lat": 33.6538958, "lng": -112.0833521}, {"n": "CoinFlip - Sams Mini", "a": "18440 N 7th St, Phoenix", "lat": 33.6541659, "lng": -112.0667794}, {"n": "CoinFlip - Greenway Liquor", "a": "3502 W Greenway Rd, Phoenix", "lat": 33.6255504, "lng": -112.1339396}, {"n": "LibertyX - Walgreens", "a": "10602 N 32nd St, Phoenix", "lat": 33.5828586, "lng": -112.0135465}, {"n": "Coin Time", "a": "1851 W Northern Ave, Phoenix", "lat": 33.5526471, "lng": -112.0991721}]}'::jsonb,
  now() + interval '90 days'
) on conflict (token) do update set deck = excluded.deck;
