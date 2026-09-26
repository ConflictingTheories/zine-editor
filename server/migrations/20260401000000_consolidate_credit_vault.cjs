/**
 * Consolidate the fragmented monetization ledgers into a single credit vault.
 *
 * Before this migration, value lived in four places that could not reconcile:
 *   - `credits.balance`       (denormalised Stripe/XRP balance, could drift)
 *   - `tokens` + `trust_lines`(creator-issued XRPL currency)
 *   - `contributions`         (per-zine crowdfunding rows)
 *   - `sovereign_tokens`      (steganographic ownership tokens + gates)
 *
 * After this migration:
 *   - `accounts`      the *type* of an account (user/fees/escrow). No balance.
 *   - `ledger_entries` append-only signed movements. Balance = SUM(amount).
 *   - `purchases`     explicit "this reader may read this zine" facts, which
 *                     is what the access check reads.
 *
 * Existing `credits` balances are migrated into the ledger as a `migration`
 * grant so no user loses their balance, then the legacy columns/tables that the
 * new code no longer reads are dropped.
 */
exports.up = async function (knex) {
    const has = (table) => knex.schema.hasTable(table);

    // ── New tables ────────────────────────────────────────────────────────
    if (!await has('accounts')) {
        await knex.schema.createTable('accounts', (table) => {
            table.increments('id').primary();
            // 'user' | 'fees' | 'escrow' | 'system'
            table.string('kind').notNullable().defaultTo('user');
            table.string('ref_type').notNullable();
            table.string('ref_id').notNullable();
            table.string('label');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            // A given party may only ever have one account row.
            table.unique(['ref_type', 'ref_id']);
        });
    }

    if (!await has('ledger_entries')) {
        await knex.schema.createTable('ledger_entries', (table) => {
            table.increments('id').primary();
            // Account this entry belongs to. Balance is the sum over these.
            table.string('ref_type').notNullable();
            table.string('ref_id').notNullable();
            // Integer units (1 unit = 1 cent). Negative = debit.
            table.integer('amount_units').notNullable();
            // grant | zine_purchase | platform_fee | refund | migration | adjustment
            table.string('reason').notNullable();
            table.string('memo');
            // The other side of the movement, for a readable ledger.
            table.string('counterparty');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            // Balances are always derived, so index the grouping key.
            table.index(['ref_type', 'ref_id'], 'ledger_balance_idx');
            table.index(['reason'], 'ledger_reason_idx');
        });
    }

    if (!await has('purchases')) {
        await knex.schema.createTable('purchases', (table) => {
            table.increments('id').primary();
            table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.integer('zine_id').notNullable().references('id').inTable('zines').onDelete('CASCADE');
            // What was paid, in integer units. 0 for crowdfunded access.
            table.integer('price_units').defaultTo(0);
            table.string('currency').defaultTo('USD');
            // 'purchase' | 'contribution' | 'crowdfund_unlock' | 'promo'
            table.string('source').defaultTo('purchase');
            table.string('payment_ref');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            // One unlock per reader per zine. The unique index is what makes
            // the access check a single indexed lookup, and makes double-spend
            // on unlock impossible.
            table.unique(['user_id', 'zine_id']);
        });
    }

    // ── Migrate existing `credits` balances into the ledger ────────────────
    if (await has('credits')) {
        const rows = await knex('credits').select('user_id', 'balance').whereNotNull('user_id');
        for (const row of rows) {
            const units = Math.round(Number(row.balance) * 100);
            if (!Number.isFinite(units) || units === 0) continue;

            await knex('accounts')
                .insert({
                    kind: 'user',
                    ref_type: 'user',
                    ref_id: String(row.user_id),
                    label: `user:${row.user_id}`
                })
                .onConflict(['ref_type', 'ref_id'])
                .ignore();

            const existing = await knex('ledger_entries')
                .where({ ref_type: 'user', ref_id: String(row.user_id), reason: 'migration' })
                .first();
            if (existing) continue;

            await knex('ledger_entries').insert({
                ref_type: 'user',
                ref_id: String(row.user_id),
                amount_units: units,
                reason: 'migration',
                memo: 'Balance carried over from the legacy credits table',
                counterparty: 'system',
                created_at: knex.fn.now()
            });
        }
    }

    // ── Migrate crowdfund contributions into purchases ─────────────────────
    // A contributor to a crowdfunded zine is explicitly recorded as having
    // access, so the reader's access check is one lookup rather than a join
    // against a legacy table.
    if (await has('contributions') && await has('zines')) {
        const rows = await knex('contributions')
            .select('contributions.user_id', 'contributions.zine_id', 'contributions.amount')
            .join('zines', 'zines.id', 'contributions.zine_id')
            .where('zines.monetization_type', 'crowdfund');
        for (const row of rows) {
            if (!row.user_id || !row.zine_id) continue;
            await knex('purchases')
                .insert({
                    user_id: row.user_id,
                    zine_id: row.zine_id,
                    price_units: Math.round(Number(row.amount || 0) * 100),
                    currency: 'USD',
                    source: 'contribution',
                    created_at: knex.fn.now()
                })
                .onConflict(['user_id', 'zine_id'])
                .ignore();
        }
    }

    // ── Drop superseded schema ────────────────────────────────────────────
    // `credits` is removed because the balance column is exactly the thing
    // that drifted. It is retained in git history and its contents are now
    // fully represented in ledger_entries.
    await knex.schema.dropTableIfExists('trust_lines');
    await knex.schema.dropTableIfExists('bids');
    await knex.schema.dropTableIfExists('sovereign_tokens');
    await knex.schema.dropTableIfExists('delegated_tokens');
    await knex.schema.dropTableIfExists('content_gates');
    await knex.schema.dropTableIfExists('scee_keys');
    await knex.schema.dropTableIfExists('credits');

    // Token-marketplace columns on zines are replaced by `price_units`.
    if (await knex.schema.hasColumn('zines', 'token_price')) {
        await knex.schema.table('zines', (t) => t.dropColumn('token_price'));
    }
    if (await knex.schema.hasColumn('zines', 'is_token_gated')) {
        await knex.schema.table('zines', (t) => t.dropColumn('is_token_gated'));
    }

    if (!await knex.schema.hasColumn('zines', 'price_units')) {
        await knex.schema.table('zines', (t) => {
            // Price in integer units. 0 = free.
            t.integer('price_units').defaultTo(0);
            t.string('currency').defaultTo('USD');
            // Browse cards and the published list need a one-line summary;
            // it was collected by the publish dialog but never stored.
            t.text('description');
        });
    } else if (!await knex.schema.hasColumn('zines', 'description')) {
        await knex.schema.table('zines', (t) => t.text('description'));
    }
    if (!await knex.schema.hasColumn('zines', 'cover_image')) {
        // A neutral cover plate for browse cards, so the grid is not a wall of
        // placeholder icons. Set on publish from the first page background.
        await knex.schema.table('zines', (t) => t.text('cover_image'));
    }
};

exports.down = async function (knex) {
    await knex.schema.createTable('credits', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unique().references('id').inTable('users');
        table.decimal('balance', 10, 2).defaultTo(0);
        table.decimal('total_spent', 10, 2).defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.dropTableIfExists('purchases');
    await knex.schema.dropTableIfExists('ledger_entries');
    await knex.schema.dropTableIfExists('accounts');
};
