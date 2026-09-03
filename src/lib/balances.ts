export type SplitLite = { personId: string; shareAmount: number };
export type PaymentLite = { personId: string; amountPaid: number };
export type ExpenseLite = { amount: number; splits: SplitLite[]; payments: PaymentLite[] };
export type SettlementLite = { fromPersonId: string; toPersonId: string; amount: number };

/**
 * Computes each OTHER person's balance relative to `selfPersonId` only —
 * not their position in the group as a whole. Positive = they owe self.
 * Negative = self owes them. A debt between two people that doesn't
 * involve self (e.g. "Razaq paid for Kaif's share") is intentionally
 * excluded — it doesn't affect what you're owed or what you owe.
 */
export function computeSelfRelativeBalances(
    selfPersonId: string,
    expenses: ExpenseLite[],
    settlements: SettlementLite[]
): Record<string, number> {
    const net: Record<string, number> = {};

    for (const expense of expenses) {
        const total = expense.amount;
        if (total <= 0) continue;
        for (const split of expense.splits) {
            for (const payment of expense.payments) {
                if (split.personId === payment.personId) continue; // no self-debt
                const portion = split.shareAmount * (payment.amountPaid / total);
                if (portion <= 0.0001) continue;

                if (split.personId === selfPersonId && payment.personId !== selfPersonId) {
                    net[payment.personId] = (net[payment.personId] ?? 0) - portion; // self owes them
                } else if (payment.personId === selfPersonId && split.personId !== selfPersonId) {
                    net[split.personId] = (net[split.personId] ?? 0) + portion; // they owe self
                }
                // else: neither side is self — irrelevant to self's balances
            }
        }
    }

    for (const s of settlements) {
        if (s.fromPersonId === selfPersonId && s.toPersonId !== selfPersonId) {
            net[s.toPersonId] = (net[s.toPersonId] ?? 0) + s.amount;
        } else if (s.toPersonId === selfPersonId && s.fromPersonId !== selfPersonId) {
            net[s.fromPersonId] = (net[s.fromPersonId] ?? 0) - s.amount;
        }
    }

    for (const key of Object.keys(net)) {
        net[key] = Math.round(net[key] * 100) / 100;
    }
    return net;
}