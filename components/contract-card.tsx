import { CalendarDays, Coins, User } from "lucide-react";
import Link from "next/link";
import { contractProgress, contractStatus, lineProgress } from "@/lib/contract-progress";
import type { ContractWithLines } from "@/lib/contracts";
import { formatDay } from "@/lib/dates";
import { formatNumber, plural, septims } from "@/lib/pricing";

/** A bar filled to `percent`, read out as such. */
export function ProgressBar({ percent, label, done }: { percent: number; label: string; done: boolean }) {
  return (
    <div
      className={`progress${done ? " progress-done" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * A contract's card: each merchandise it asks for against the stock now, and
 * how far the whole is. `editHref` is the address of its page, for a gérant;
 * `today` ("YYYY-MM-DD", in Paris) tells an open contract past its day.
 */
export function ContractCard({
  contract,
  editHref,
  today,
}: {
  contract: ContractWithLines;
  editHref?: string;
  today: string;
}) {
  const { lines } = contract;
  const progress = contractProgress(lines);
  const { allReady, late } = contractStatus(contract, today);
  return (
    <article className={`contract-card${allReady ? " contract-card-ready" : ""}`} aria-label={contract.name}>
      <div className="contract-card-head">
        <div className="badges">
          {contract.paid ? (
            <span className="badge badge-green">Payé</span>
          ) : contract.delivered ? (
            <span className="badge badge-blue">Livré, argent attendu</span>
          ) : allReady ? (
            <span className="badge badge-green">Prêt à livrer</span>
          ) : (
            <span className="badge badge-gold">En cours</span>
          )}
          {late && <span className="badge badge-red">Échéance passée</span>}
        </div>
        {editHref && (
          <Link className="btn btn-small btn-ghost" href={editHref} aria-label={`Modifier ${contract.name}`}>
            Modifier
          </Link>
        )}
      </div>
      <h3>{contract.name}</h3>
      {(contract.client || contract.dueOn || contract.price != null) && (
        <p className="contract-meta">
          {contract.client && (
            <span>
              <User size={15} aria-hidden /> {contract.client}
            </span>
          )}
          {contract.dueOn && (
            <span>
              <CalendarDays size={15} aria-hidden /> Pour le {formatDay(contract.dueOn)}
            </span>
          )}
          {contract.price != null && (
            <span>
              <Coins size={15} aria-hidden /> {septims(contract.price)}
            </span>
          )}
        </p>
      )}
      {lines.length === 0 ? (
        <p className="small muted">Aucune marchandise demandée pour l&apos;instant.</p>
      ) : contract.delivered ? (
        // Delivered: its merchandises left the stock, which no longer says anything of it.
        <ul className="contract-lines" aria-label={`Marchandises de ${contract.name}`}>
          {lines.map((line) => (
            <li key={line.id}>
              <div className="contract-line-head">
                <span>{line.productName}</span>
                <span className="contract-line-count">
                  <strong>{formatNumber(line.quantity)}</strong>{" "}
                  <span className="small muted">{plural(line.unit, line.quantity)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="contract-total">
            <span>
              <strong>{progress.percent} %</strong>{" "}
              <span className="small muted">
                {formatNumber(progress.ready)} marchandise{progress.ready > 1 ? "s" : ""} prête
                {progress.ready > 1 ? "s" : ""} sur {formatNumber(progress.total)}
              </span>
            </span>
          </div>
          <ProgressBar percent={progress.percent} label={`Progression de ${contract.name}`} done={allReady} />
          <ul className="contract-lines" aria-label={`Marchandises de ${contract.name}`}>
            {lines.map((line) => {
              const p = lineProgress(line);
              return (
                <li key={line.id}>
                  <div className="contract-line-head">
                    <span>{line.productName}</span>
                    <span className="contract-line-count">
                      <strong>
                        {formatNumber(p.ready)} / {formatNumber(line.quantity)}
                      </strong>{" "}
                      <span className="small muted">{plural(line.unit, line.quantity)}</span>
                    </span>
                  </div>
                  <ProgressBar percent={p.percent} label={line.productName} done={p.done} />
                  <span className={`small ${p.done ? "plus" : "muted"}`}>
                    {p.done ? "Prêt" : `Manque ${formatNumber(p.missing)} ${plural(line.unit, p.missing)}`}
                    {line.stock > line.quantity && ` · ${formatNumber(line.stock)} en stock`}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </article>
  );
}
