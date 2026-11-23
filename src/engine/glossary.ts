// Kid-friendly glossary for the inline Popover terms (SPEC §7.1).
export interface GlossaryEntry {
  termHe: string;
  explanationHe: string;
}

export const GLOSSARY = {
  compound: {
    termHe: 'ריבית דריבית',
    explanationHe: 'כשהכסף בעץ החיסכון מרוויח ריבית, וגם הריבית עצמה מתחילה להרוויח ריבית. ככה העץ גדל מהר יותר ככל שמחכים.',
  },
  index: {
    termHe: 'מדד',
    explanationHe: 'סל שיש בו קצת מהרבה חברות ביחד. אם חברה אחת נופלת, האחרות מחזיקות את הסל.',
  },
  dividend: {
    termHe: 'דיבידנד',
    explanationHe: 'כסף שעסק שלך משלם לך כל חודש, בלי שתצטרך למכור אותו. כמו דוכן הלימונדה שמכניס כסף.',
  },
  emergency: {
    termHe: 'קרן חירום',
    explanationHe: 'כסף מזומן ששומרים בצד להפתעות — כמו אופניים שהתקלקלו — כדי לא למכור השקעות בזמן לא טוב.',
  },
  diversification: {
    termHe: 'פיזור',
    explanationHe: 'לא שמים את כל הביצים בסל אחד. כשיש כמה סוגי השקעות, נפילה של אחת פוגעת פחות.',
  },
  passive: {
    termHe: 'השקעה פסיבית',
    explanationHe: 'קונים משהו טוב לטווח ארוך ונותנים לו זמן לגדול, בלי לקנות ולמכור כל יום.',
  },
  volatility: {
    termHe: 'תנודתיות',
    explanationHe: 'כמה המחיר קופץ למעלה ולמטה. מניה תנודתית יכולה לעלות הרבה — וגם לרדת הרבה.',
  },
  benchmark: {
    termHe: 'השוואה למדד',
    explanationHe: 'בודקים אם הבחירות שלך הצליחו יותר או פחות ממי שפשוט שם הכול בסל השוק הכללי.',
  },
  fixed_expenses: {
    termHe: 'הוצאות קבועות',
    explanationHe: 'כסף שיוצא כל חודש, כמו הסעה וחוגים. אפשר לפעמים להוריד אותן במיקוח.',
  },
  watchlist: {
    termHe: 'רשימת מעקב',
    explanationHe: 'מסמנים כוכב על מניה כדי לראות איך היא מתנהגת כמה ימים — לפני שמחליטים לקנות.',
  },
  inflation: {
    termHe: 'אינפלציה',
    explanationHe: 'כשהמחירים של דברים עולים עם הזמן. כסף ששוכב סתם במגירה קונה פחות, ולכן כדאי שהכסף יעבוד בעץ החיסכון או בנכסים.',
  },
  real_estate: {
    termHe: 'נדל״ן',
    explanationHe: 'בתים, דירות וחנויות. אנשים ועסקים משלמים שכירות כדי להשתמש בהם, וככה הנכס מכניס כסף.',
  },
  gold: {
    termHe: 'זהב',
    explanationHe: 'מתכת יקרה ונדירה. כשיש בלגן או חשש בעולם, הרבה משקיעים קונים זהב כדי לשמור על הכסף שלהם.',
  },
  sector_control: {
    termHe: 'שליטה בזירות',
    explanationHe: 'כמו במשחק לוח אסטרטגי: המטרה היא לבנות נוכחות בלפחות 3 מתוך 5 זירות הכלכלה (עץ חיסכון, סל שוק, מניות/זהב, אנרגיה ועסקים מניבים).',
  },
  charity: {
    termHe: 'תרומה ומעשר',
    explanationHe: 'הפרשת חלק קטן מההכנסה שלנו (עד עשירית — 10% מההכנסה החודשית) לעזרה לאחרים. במשחק זה מעניק כוכבי ניקוד ⭐ ומלמד נתינה אחראית כחלק מהתקציב!',
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
