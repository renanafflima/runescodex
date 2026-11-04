import { groupHuntVocations } from "../../domain/hunts";
import { formatLevelRange, formatRate } from "../../domain/format";
import { VOCATION_LABEL, type VocationCode } from "../../domain/vocation";
import type { HuntVocation } from "../../services/api/types";

type HuntVocationBreakdownProps = {
  vocations: HuntVocation[];
};

function vocationLabel(code: string) {
  return VOCATION_LABEL[code as VocationCode] || code;
}

/**
 * Shows every HuntVocation row grouped by vocation. A vocation can have
 * several level ranges in the same hunt (e.g. ED 270-399 and ED 400-600),
 * each with its own xpPerHour/profitPerHour — ranges are never merged or
 * averaged, and a hunt is not assumed to have every vocation or range.
 */
export function HuntVocationBreakdown({ vocations }: HuntVocationBreakdownProps) {
  const groups = groupHuntVocations(vocations);
  if (groups.length === 0) return null;

  return (
    <div className="hunt-vocations">
      {groups.map((group) => (
        <div className="hunt-vocations__group" key={group.vocation}>
          <h3 className="hunt-vocations__name">{vocationLabel(group.vocation)}</h3>
          <ul className="hunt-vocations__ranges">
            {group.ranges.map((range, index) => (
              <li className="hunt-vocations__range" key={`${group.vocation}-${index}`}>
                <div className="hunt-vocations__level">
                  <span>Level {formatLevelRange(range.levelMin, range.levelMax) || "—"}</span>
                  {range.isRecommended ? (
                    <span className="hunt-vocations__badge">Recomendada</span>
                  ) : null}
                </div>
                <span className="hunt-vocations__stats">
                  {[
                    formatRate(range.xpPerHour) ? `${formatRate(range.xpPerHour)} XP/h` : "— XP/h",
                    formatRate(range.profitPerHour) ? `${formatRate(range.profitPerHour)} Profit/h` : "— Profit/h",
                  ].join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
