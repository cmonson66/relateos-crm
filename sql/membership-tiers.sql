-- ---------------------------------------------------------------------------
-- Membership tiers on the products table.
--
-- The purchase agreement and the invoice build their numbers from these rows
-- rather than from lib/pricing.ts, so a tier that is not here cannot be put on
-- a deal at all. Before this, a rep quoting the group plan had no line to pick.
--
-- Three columns the first version of this file got wrong: org_id is NOT NULL
-- with no default, kind defaults to 'hardware' when a membership needs to be
-- 'subscription', and sku is required. Guarded with `where not exists` on the
-- sku so it is safe to run more than once whatever constraints exist.
-- ---------------------------------------------------------------------------

-- Preferred service, charged per terminal.
insert into products (org_id, sku, name, kind, billing, unit_price_cents, active)
select '6656a6ea-0a1e-4396-aa0f-88266b934daa', 'PREFERRED-4999',
       'Preferred service (per terminal, billed annually)',
       'subscription', 'monthly', 4999, true
where not exists (select 1 from products where sku = 'PREFERRED-4999');

-- The flat group plan. QUANTITY IS ALWAYS 1 - it covers every terminal, so a
-- rep must not multiply it by the location count.
insert into products (org_id, sku, name, kind, billing, unit_price_cents, active)
select '6656a6ea-0a1e-4396-aa0f-88266b934daa', 'GROUP-9999',
       'Group plan, all terminals (preferred included, billed annually)',
       'subscription', 'monthly', 9999, true
where not exists (select 1 from products where sku = 'GROUP-9999');

-- Retired. Preferred replaced white-glove at $49.99, and leaving this active
-- means a rep can still drop a $99.00 line on a signed agreement that is
-- $49.01 above the real price. Deactivated rather than deleted so historical
-- deals keep their line items.
update products set active = false where sku = 'WHITEGLOVE-99';

-- Also stale: the per-scanner monthly is the model lib/pricing.ts says was
-- wrong. Uncomment if it is genuinely dead.
-- update products set active = false where sku = 'SCANNER-1999';

select sku, name, billing, unit_price_cents, active
from products order by active desc, unit_price_cents;
