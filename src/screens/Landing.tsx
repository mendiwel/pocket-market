import { SavingsTree } from '../components/SavingsTree';
import { Sparkline } from '../components/Charts';
import { Speak } from '../components/Speak';

const CURRICULUM = [
  { icon: '🌳', title: 'ריבית דריבית', how: 'עץ חיסכון שגדל וצומח מטבעות זהב ככל שלא נוגעים בו.', lesson: 'סבלנות הופכת כסף קטן לכסף גדול.' },
  { icon: '🧘', title: 'השקעה פסיבית וסבלנות', how: 'כפתור "נשארים פסיביים היום" שמזכה בכוכבים, וסל שוק כללי שעולה לאט ובטוח.', lesson: 'לא צריך לקנות ולמכור כל יום.' },
  { icon: '🥅', title: 'קרן חירום', how: 'הפתעות בתיבת הדואר — שרשרת אופניים שנקרעה, ספר שאבד.', lesson: 'מי שאין לו מזומן בצד נאלץ למכור השקעות בזמן רע.' },
  { icon: '🍋', title: 'הכנסה פסיבית ונדל״ן', how: 'קונים דוכן לימונדה, מכונת משחקים או חנויות להשכרה שמכניסים כסף כל חודש.', lesson: 'נכסים שעובדים בשבילך.' },
  { icon: '🤝', title: 'מיקוח ותקציב', how: 'שיחה עם נציג שירות שמעלה מחיר: לבקש יפה, להשוות, או... לבלף.', lesson: 'הוצאות קבועות אפשר לשנות — אבל לא מאיימים על מה שבאמת צריך.' },
  { icon: '🎲', title: 'שליטה ב-5 זירות השוק', how: 'לוח אסטרטגי עם 5 זירות: עץ חיסכון, סל שוק, נדל״ן ויסוד, זהב ואנרגיה, ועסקים.', lesson: 'מי שמפזר ושולט ב-3 זירות או יותר בונה תיק עמיד לכל סערה.' },
];

const STEPS = [
  { icon: '☀️', title: 'תדריך בוקר', text: 'מזג אוויר אמיתי, חדשות שוק ידידותיות, דמי כיס והוצאות.' },
  { icon: '📬', title: 'תיבת דואר', text: 'הפתעות, הכנסות, ושיחות מיקוח עם נציגים.' },
  { icon: '🛒', title: 'פעולות', text: 'לחסוך, להשקיע, לקנות עסק — או לבחור לא לעשות כלום.' },
  { icon: '🌙', title: 'סיום והעברה', text: 'כוכבים ורצף, נעילה עד מחר, והתור עובר לאח הבא.' },
];

export function Landing() {
  const heroSpeak =
    'ברוכים הבאים לשוק הכיס! כסף זה משחק ילדים. משחק אוריינות פיננסית משפחתי לגילאי חמש עד שתים עשרה. חמש עשרה דקות ביום, כל המשפחה בשוק אחד.';
  return (
    <div className="landing">
      <header className="hero">
        <div className="hero__text">
          <p className="eyebrow">🎲 משחק לוח פיננסי משפחתי · גילאי 5–12 · כסף זה משחק ילדים!</p>
          <h1>
            שוק הכיס <Speak text={heroSpeak} label="הקראה קולית" showText />
          </h1>
          <p className="hero__lead">
            15 דקות ביום, בלי טלפון, כל המשפחה בשוק אחד. הילדים כובשים 5 זירות כלכליות — עץ חיסכון, סל השוק, נדל״ן, זהב ואנרגיה ועסקים מניבים — ולומדים ריבית דריבית, פיזור ומיקוח!
          </p>
          <div className="row row--wrap">
            <a className="btn btn--primary btn--lg" href="#/demo">נסו עכשיו בלי הרשמה ▶</a>
            <a className="btn btn--lg" href="#/family">כניסה למשפחה שלי</a>
          </div>
          <ul className="hero__points">
            <li>⏳ 15 דקות ביום — טיימר רגוע, לא לחוץ</li>
            <li>📅 יום אמיתי = חודש במשחק</li>
            <li>🖥️ בדפדפן, בלי טלפון לילדים</li>
            <li>🧒 שלושה מסלולי גיל — שוק משותף אחד</li>
          </ul>
        </div>
        <div className="hero__art" aria-hidden="true">
          <SavingsTree balance={820} streakMonths={9} size={300} />
        </div>
      </header>

      <section className="section" aria-labelledby="how-h">
        <h2 id="how-h">איך נראה תור?</h2>
        <ol className="flow">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flow__step">
              <span className="flow__n">{i + 1}</span>
              <span className="big-emoji" aria-hidden="true">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="cur-h">
        <h2 id="cur-h">מה לומדים — ואיך?</h2>
        <ul className="curriculum">
          {CURRICULUM.map((c) => (
            <li key={c.title} className="card cur">
              <span className="cur__icon" aria-hidden="true">{c.icon}</span>
              <h3>{c.title}</h3>
              <p><strong>במשחק:</strong> {c.how}</p>
              <p className="muted"><strong>השיעור:</strong> {c.lesson}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="tiers-h">
        <h2 id="tiers-h">אותו שוק, שלושה מסכים שונים</h2>
        <p className="muted">כל הילדים רואים את אותן חדשות ואותו מזג אוויר — מה שמזמין שיחה משפחתית. רמת הפירוט מותאמת לגיל.</p>
        <div className="gallery">
          <figure className="card preview">
            <div className="mock mock--early" aria-hidden="true">
              <div className="mock__speaker">🔊 "בוקר טוב נועם! היום שמשי…"</div>
              <div className="mock__row"><span className="mock__big">🌳</span><span className="mock__big">🐷</span><span className="mock__big">🍦📈</span></div>
              <div className="mock__btn mock__btn--passive">🧘 נשארים פסיביים</div>
              <div className="mock__row"><span className="mock__chip">🌱 20 ₪</span><span className="mock__chip">🌱 50 ₪</span></div>
            </div>
            <figcaption>
              <strong>גיל 5–6 · צעירים</strong>
              <ul>
                <li>הקראה אוטומטית בעברית לכל מסך</li>
                <li>אייקונים גדולים ומצבי רוח 😊📈</li>
                <li>3–4 פעולות בלבד, 3 בחירות במיקוח</li>
              </ul>
            </figcaption>
          </figure>
          <figure className="card preview">
            <div className="mock mock--mid" aria-hidden="true">
              <div className="mock__stock"><span>🍦 גלידות ותיירות</span><span className="up">▲ 3.2%</span><Sparkline values={[90, 92, 89, 95, 97, 96, 99]} width={90} height={26} /></div>
              <div className="mock__stock"><span>⚡ חשמל ואנרגיה ⭐</span><span className="down">▼ 1.1%</span><Sparkline values={[80, 82, 84, 83, 81, 80, 79]} width={90} height={26} /></div>
              <div className="mock__stock"><span>🍋 דוכן לימונדה</span><span className="up">+20 ₪/חודש</span></div>
            </div>
            <figcaption>
              <strong>גיל 8–10 · ביניים</strong>
              <ul>
                <li>מספרים ואחוזים לצד אייקונים</li>
                <li>כל הסקטורים, רשימת מעקב ⭐, עסקים פסיביים</li>
                <li>כפתור הקראה ליד כל טקסט, 4 אפשרויות מיקוח</li>
              </ul>
            </figcaption>
          </figure>
          <figure className="card preview">
            <div className="mock mock--adv" aria-hidden="true">
              <svg viewBox="0 0 200 80" width="100%" height="80">
                <polyline points="0,60 30,55 60,58 90,40 120,44 150,30 200,22" fill="none" stroke="var(--brand)" strokeWidth="3" />
                <polyline points="0,60 30,57 60,54 90,50 120,46 150,42 200,38" fill="none" stroke="var(--bench)" strokeWidth="2" strokeDasharray="5 4" />
              </svg>
              <div className="mock__bar"><span style={{ flexGrow: 3 }} className="seg--cash" /><span style={{ flexGrow: 2 }} className="seg--tree" /><span style={{ flexGrow: 4 }} className="seg--stocks" /><span style={{ flexGrow: 2 }} className="seg--biz" /></div>
              <div className="mock__row mock__row--small"><span>🧩 פיזור: 4 סוגים</span><span>🍋 32 ₪ / 🧾 50 ₪</span></div>
            </div>
            <figcaption>
              <strong>גיל 11–12 · מתקדמים</strong>
              <ul>
                <li>גרף ביצועים מול קו מקווקו של המדד</li>
                <li>הכנסה פסיבית מול הוצאות קבועות</li>
                <li>מדד פיזור ומיקוח מתקדם (מוכן ל-AI)</li>
              </ul>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section" aria-labelledby="parents-h">
        <h2 id="parents-h">בשביל ההורים</h2>
        <ul className="curriculum">
          <li className="card cur"><span className="cur__icon">🔒</span><h3>אזור הורים בקוד</h3><p>הוספת ילדים, קביעת מסלול גיל, פתיחת תור נוסף.</p></li>
          <li className="card cur"><span className="cur__icon">🧹</span><h3>חיבור לחיים האמיתיים</h3><p>בונוסים וירטואליים על עזרה בבית, דמי כיס וחדשות משפחתיות.</p></li>
          <li className="card cur"><span className="cur__icon">📊</span><h3>מעקב התקדמות</h3><p>שווי, פיזור, רצף והישגים — לכל ילד, זה לצד זה.</p></li>
          <li className="card cur"><span className="cur__icon">⚖️</span><h3>כלכלה מאוזנת</h3><p>בלי אינפלציה: פרסים הם בעיקר כוכבים ופריטים, והבונוסים הכספיים קטנים ומוגבלים.</p></li>
        </ul>
        <div className="cta-final">
          <a className="btn btn--primary btn--lg" href="#/demo">נסו את הדמו — 3 גילאים בלחיצה ▶</a>
        </div>
      </section>

      <footer className="footer">
        <p>שוק הכיס · כסף וירטואלי בלבד · ללא פרסומות · מזג אוויר: Open-Meteo</p>
      </footer>
    </div>
  );
}
