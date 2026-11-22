import { Avatar } from '../components/Avatar';
import { TIER_LABEL_HE } from '../engine/seed';
import { netWorth } from '../engine/portfolio';
import { money } from '../engine/format';
import { WEATHER_LABEL } from '../engine/weather';
import { useGame } from '../hooks/useFamilyGame';
import { speak } from '../hooks/tts';

export function FamilySelector({ onPick, onParent }: { onPick: (childId: string) => void; onParent: () => void }) {
  const { family, today, mode } = useGame();
  const wl = WEATHER_LABEL[family.weather.condition];
  const allDone = family.children.length > 0 && family.children.every((c) => c.lastTurnDate === today);
  return (
    <section className="selector" aria-labelledby="sel-h">
      <header className="selector__head">
        <div>
          <h1 id="sel-h">משפחת {family.familyNameHe} — מי משחק עכשיו?</h1>
          <p className="muted">
            חודש {family.currentMonth} בשוק · {wl.icon} {family.weather.temperatureC}° {wl.he}
            {family.activeMacroEvent && <> · {family.activeMacroEvent.icon} {family.activeMacroEvent.titleHe}</>}
          </p>
        </div>
        <button type="button" className="btn" onClick={onParent}>🔒 אזור הורים</button>
      </header>
      {allDone && <p className="gentle-warn">🌙 כולם סיימו להיום! השוק יתקדם בחודש מחר.</p>}
      <ul className="kids">
        {family.children.map((c) => {
          const done = mode !== 'demo' && c.lastTurnDate === today;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`kid${done ? ' kid--done' : ''}`}
                disabled={done}
                onClick={() => onPick(c.id)}
                onFocus={() => c.tier === 'early' && !done && speak(c.name)}
                aria-label={`${c.name}, גיל ${c.age}${done ? ', סיים להיום' : ''}`}
              >
                <Avatar avatarId={c.avatarId} accessory={c.equippedAccessory} size={88} />
                {done && <span className="kid__badge" aria-hidden="true">✅</span>}
                <strong className="kid__name">{c.name}</strong>
                <span className="muted">גיל {c.age} · {TIER_LABEL_HE[c.tier]}</span>
                <span className="kid__stats">
                  <span title="כוכבים">⭐ {c.xp}</span>
                  <span title="רצף ימים">🔥 {c.dailyStreak}</span>
                  <span title="שווי">💰 {money(netWorth(c, family.assets))}</span>
                </span>
                {done && <span className="kid__lock">נתראה מחר</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
