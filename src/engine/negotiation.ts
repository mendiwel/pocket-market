import type { AgeTier, Bill } from '../types';

// ---------------------------------------------------------------------------
// Virtual Representative (SPEC §8)
//
// The UI talks only to `NegotiationProvider`. Phase 1 ships the scripted
// decision tree below (zero API cost). A Phase 2 LLM provider (e.g. Gemini)
// implements the same interface — it receives the full transcript in
// `history`, may set `allowFreeText` on its steps, and must still return a
// structured `outcome` so the economy stays in control of the numbers.
// ---------------------------------------------------------------------------

export type NegotiationStyle = 'polite' | 'threaten' | 'competitor' | 'accept' | 'followup';

export interface NegotiationOption {
  id: string;
  labelHe: string;
  icon: string;
  style: NegotiationStyle;
}

export interface NegotiationOutcome {
  finalAmount: number;
  cancelled: boolean;
  win: boolean;
  lessonHe: string;
}

export interface NegotiationStep {
  repMessageHe: string;
  options: NegotiationOption[];
  allowFreeText?: boolean;
  outcome?: NegotiationOutcome;
}

export interface NegotiationContext {
  bill: Bill;
  hikeAmount: number;
  tier: AgeTier;
  childName: string;
}

export interface NegotiationTurn {
  optionId?: string;
  freeText?: string;
}

export interface NegotiationProvider {
  readonly id: string;
  start(ctx: NegotiationContext): Promise<NegotiationStep>;
  respond(ctx: NegotiationContext, history: NegotiationTurn[]): Promise<NegotiationStep>;
}

const OPT = {
  polite: { id: 'polite', icon: '🙂', style: 'polite', labelHe: 'בנימוס: "אפשר בבקשה מחיר טוב יותר?"' },
  threaten: { id: 'threaten', icon: '✋', style: 'threaten', labelHe: 'לאיים: "אם המחיר יעלה — אני מבטל!"' },
  competitor: { id: 'competitor', icon: '🔍', style: 'competitor', labelHe: 'להשוות: "אצל המתחרים זה זול יותר."' },
  accept: { id: 'accept', icon: '👍', style: 'accept', labelHe: 'לקבל: "בסדר, אשלם את המחיר החדש."' },
} satisfies Record<string, NegotiationOption>;

const OPT_EARLY_LABELS: Record<string, string> = {
  polite: 'לבקש יפה',
  threaten: 'להגיד שאבטל',
  accept: 'להסכים',
};

function optionsFor(tier: AgeTier): NegotiationOption[] {
  if (tier === 'early') {
    return [OPT.polite, OPT.threaten, OPT.accept].map((o) => ({ ...o, labelHe: OPT_EARLY_LABELS[o.id] }));
  }
  return [OPT.polite, OPT.threaten, OPT.competitor, OPT.accept];
}

/** Deterministic, tier-aware decision tree. */
export class ScriptedNegotiationProvider implements NegotiationProvider {
  readonly id = 'scripted-v1';

  async start(ctx: NegotiationContext): Promise<NegotiationStep> {
    const { bill, hikeAmount, childName } = ctx;
    return {
      repMessageHe: `שלום ${childName}! כאן הנציג של ${bill.nameHe}. מהחודש הבא המחיר יעלה מ-${bill.amount} ₪ ל-${bill.amount + hikeAmount} ₪ לחודש.`,
      options: optionsFor(ctx.tier),
    };
  }

  async respond(ctx: NegotiationContext, history: NegotiationTurn[]): Promise<NegotiationStep> {
    const { bill, hikeAmount, tier } = ctx;
    const old = bill.amount;
    const hiked = old + hikeAmount;
    const path = history.map((h) => h.optionId).join('>');

    switch (path) {
      case 'accept':
        return {
          repMessageHe: 'תודה! המחיר החדש נכנס לתוקף מהחודש הבא.',
          options: [],
          outcome: { finalAmount: hiked, cancelled: false, win: false, lessonHe: 'לפעמים שווה לנסות לבקש — הכי גרוע, אומרים "לא".' },
        };

      case 'polite': {
        const partial = old + Math.ceil(hikeAmount / 2);
        if (tier === 'early') {
          return {
            repMessageHe: `ביקשת יפה! המחיר יעלה רק ל-${partial} ₪.`,
            options: [],
            outcome: { finalAmount: partial, cancelled: false, win: true, lessonHe: 'בקשה מנומסת עוזרת לחסוך.' },
          };
        }
        return {
          repMessageHe: `אני מעריך את הנימוס. אני יכול להציע ${partial} ₪ במקום ${hiked} ₪.`,
          options: [
            { id: 'take', icon: '👍', style: 'accept', labelHe: `מסכים/ה ל-${partial} ₪` },
            { id: 'loyal', icon: '🤝', style: 'followup', labelHe: '"אני לקוח/ה כבר הרבה זמן. אפשר עוד קצת?"' },
          ],
        };
      }
      case 'polite>take':
        return {
          repMessageHe: 'מעולה, סגרנו!',
          options: [],
          outcome: { finalAmount: old + Math.ceil(hikeAmount / 2), cancelled: false, win: true, lessonHe: 'בקשה מנומסת חסכה לך כסף כל חודש.' },
        };
      case 'polite>loyal':
        return {
          repMessageHe: 'צודק/ת, לקוחות נאמנים מקבלים הטבה. העלייה תהיה ממש קטנה.',
          options: [],
          outcome: { finalAmount: old + Math.ceil(hikeAmount / 4), cancelled: false, win: true, lessonHe: 'מי שמבקש שוב בנימוס — מקבל עוד.' },
        };

      case 'threaten':
        if (bill.essential) {
          return {
            repMessageHe: `בסדר גמור, אז נבטל את ${bill.nameHe} מהחודש הבא.`,
            options: [{ id: 'backdown', icon: '😬', style: 'followup', labelHe: 'רגע! אני צריך/ה את זה...' }],
          };
        }
        return {
          repMessageHe: 'אנחנו לא רוצים לאבד אותך! נשאיר את המחיר הישן.',
          options: [
            { id: 'keep', icon: '👍', style: 'accept', labelHe: `להישאר במחיר ${old} ₪` },
            { id: 'cancel', icon: '✂️', style: 'followup', labelHe: 'דווקא לבטל — אני לא באמת צריך/ה את זה' },
          ],
        };
      case 'threaten>backdown':
        return {
          repMessageHe: `הבנתי. אז נשאר עם המחיר החדש: ${hiked} ₪.`,
          options: [],
          outcome: {
            finalAmount: hiked,
            cancelled: false,
            win: false,
            lessonHe: 'לא מאיימים לבטל משהו שבאמת צריכים — הנציג יכול לקרוא את הבלוף.',
          },
        };
      case 'threaten>keep':
        return {
          repMessageHe: 'תודה שנשארת איתנו!',
          options: [],
          outcome: { finalAmount: old, cancelled: false, win: true, lessonHe: 'כשמשהו לא הכרחי — מותר להגיד "לא" למחיר גבוה.' },
        };
      case 'threaten>cancel':
        return {
          repMessageHe: 'בוטל. נשמח לראות אותך שוב בעתיד.',
          options: [],
          outcome: { finalAmount: 0, cancelled: true, win: true, lessonHe: 'ביטול הוצאה שלא צריך — החיסכון הכי גדול.' },
        };

      case 'competitor': {
        const beat = Math.max(5, old - 2);
        return {
          repMessageHe: `בדקת? כל הכבוד. נשווה ונוריד — ${beat} ₪ לחודש.`,
          options: [],
          outcome: { finalAmount: beat, cancelled: false, win: true, lessonHe: 'מחקר והשוואת מחירים הם כוח במיקוח.' },
        };
      }
      default:
        return { repMessageHe: 'לא הבנתי, נסה/י שוב.', options: optionsFor(tier) };
    }
  }
}

export function getNegotiationProvider(): NegotiationProvider {
  return new ScriptedNegotiationProvider();
}
