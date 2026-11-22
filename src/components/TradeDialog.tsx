import { useState } from 'react';
import { CATEGORY_LABEL_HE } from '../engine/catalog';
import { money, pct, units } from '../engine/format';
import { priceChange } from '../engine/market';
import type { AgeTier, MarketAsset } from '../types';
import { Sparkline } from './Charts';
import { Modal } from './Modal';
import { Term } from './Term';

export function TradeDialog({
  asset,
  cash,
  held,
  tier,
  onClose,
  onBuy,
  onSell,
}: {
  asset: MarketAsset | null;
  cash: number;
  held: number;
  tier: AgeTier;
  onClose: () => void;
  onBuy: (amount: number) => void;
  onSell: (units: number) => void;
}) {
  const [amount, setAmount] = useState(50);
  if (!asset) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const max = Math.floor(cash);
  const amt = Math.min(amount, max);
  const heldValue = held * asset.currentPrice;
  return (
    <Modal open={!!asset} onClose={onClose} title={<>{asset.icon} {asset.nameHe}</>}>
      <p className="muted">{asset.descriptionHe}</p>
      <dl className="facts">
        <div><dt>מחיר ליחידה</dt><dd>{money(asset.currentPrice, true)}</dd></div>
        <div><dt>שינוי מאתמול</dt><dd className={priceChange(asset) >= 0 ? 'up' : 'down'}>{pct(priceChange(asset))}</dd></div>
        <div><dt>תחום</dt><dd>{CATEGORY_LABEL_HE[asset.category]}</dd></div>
        {tier === 'advanced' && (
          <div><dt><Term k="volatility" /></dt><dd>{asset.volatility < 0.02 ? 'נמוכה' : asset.volatility < 0.04 ? 'בינונית' : 'גבוהה'}</dd></div>
        )}
      </dl>
      <Sparkline values={asset.priceHistory} width={300} height={60} />

      <section className="trade-box">
        <h3>קנייה</h3>
        {max <= 0 ? (
          <p className="muted">אין מזומן פנוי לקנייה.</p>
        ) : (
          <>
            <label className="field">
              <span>כמה כסף להשקיע? <strong>{money(amt)}</strong></span>
              <input type="range" min={1} max={max} step={1} value={amt} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>
            <div className="chips">
              {[20, 50, 100, 200].filter((v) => v <= max).map((v) => (
                <button key={v} type="button" className="chip" onClick={() => setAmount(v)}>{money(v)}</button>
              ))}
            </div>
            <p className="muted">תקבל/י {units(amt / asset.currentPrice)} יחידות. נשאר מזומן: {money(cash - amt)}</p>
            <button type="button" className="btn btn--primary" onClick={() => onBuy(amt)}>קנייה ב-{money(amt)}</button>
          </>
        )}
      </section>

      {held > 0 && (
        <section className="trade-box">
          <h3>מכירה</h3>
          <p>יש לך {units(held)} יחידות בשווי {money(heldValue)}.</p>
          <div className="row">
            <button type="button" className="btn" onClick={() => onSell(held / 2)}>למכור חצי</button>
            <button type="button" className="btn" onClick={() => onSell(held)}>למכור הכול</button>
          </div>
        </section>
      )}
    </Modal>
  );
}
