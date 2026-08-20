import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { CALENDAR_RULES } from '../lib/utils';
import { IndicatorRecord } from '../lib/types';

interface Event {
  date: Date;
  day: string;
  name: string;
  region: string;
  rule: string;
  freq: string;
  lastValue?: string;
}

function fmt(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function Calendar() {
  const { indicators } = useStore();

  const events = useMemo(() => {
    const now = new Date();
    const list: Event[] = [];
    for (const r of CALENDAR_RULES) {
      const d = r.compute(now);
      // 关联指标的最近值（回填）
      let lastValue: string | undefined;
      if (r.indicatorId) {
        const ind = indicators.find((i) => i.id === r.indicatorId) as IndicatorRecord | undefined;
        const last = ind?.monthly?.filter((p) => p.value !== null).slice(-1)[0];
        if (last) lastValue = `${last.value}${ind!.unit}（截至 ${last.month}）`;
      }
      list.push({
        date: d,
        day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        name: r.name,
        region: r.region,
        rule: r.rule,
        freq: r.freq,
        lastValue,
      });
    }
    // 未来 30 天
    return list.filter((e) => e.date >= now && e.date.getTime() - now.getTime() < 30 * 86400000)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [indicators]);

  const now = new Date();
  const grouped = useMemo(() => {
    const g = new Map<string, Event[]>();
    for (const e of events) {
      const key = `${e.date.getMonth() + 1}月${e.date.getDate()}日`;
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(e);
    }
    return [...g.entries()];
  }, [events]);

  const daysToNext = events.length ? Math.ceil((events[0].date.getTime() - now.getTime()) / 86400000) : null;

  return (
    <div>
      <h2 className="page-title">📅 宏观数据日历</h2>
      <p className="page-sub">
        未来 30 天的重磅数据发布时间表（按官方发布规则推算，节假日可能顺延；正式时间以官方公告为准）。
        每个事件附上我们仪表盘中该指标的<b>最新已发布值</b>。
      </p>

      <div className="grid grid-3 mb16">
        <div className="kpi"><div className="k">未来 30 天事件</div><div className="v">{events.length}</div><div className="s">中/美主要月度数据</div></div>
        <div className="kpi"><div className="k">下一个事件</div><div className="v" style={{ fontSize: 20 }}>{events.length ? events[0].name : '—'}</div><div className="s">{daysToNext !== null ? `${daysToNext} 天后 · ${fmt(events[0].date)}` : '本月无'}</div></div>
        <div className="kpi"><div className="k">数据源</div><div className="v" style={{ fontSize: 20 }}>官方规则</div><div className="s">金十等免费日历接口已停更，本页为自维护规则引擎</div></div>
      </div>

      {grouped.map(([day, evts]) => (
        <div className="card" key={day} style={{ marginTop: 12 }}>
          <h3 style={{ margin: 0 }}>🗓 {day} <span className="badge gray" style={{ marginLeft: 8 }}>{evts.length} 项</span></h3>
          <div className="mt8">
            {evts.map((e, i) => (
              <div key={i} className="spread" style={{ padding: '10px 0', borderTop: i ? '1px dashed var(--border)' : 'none' }}>
                <div>
                  <div className="bold small">{e.name} <span className="badge blue" style={{ marginLeft: 6 }}>{e.region}</span>
                    <span className="badge gray" style={{ marginLeft: 4 }}>{e.freq === 'weekly' ? '每周' : e.freq === 'quarterly' ? '每季' : '每月'}</span>
                  </div>
                  <div className="small muted" style={{ marginTop: 2 }}>发布规则：{e.rule}</div>
                </div>
                <div className="small" style={{ textAlign: 'right' }}>
                  {e.lastValue
                    ? <div><span className="badge up">已回填</span><div className="num muted" style={{ marginTop: 2 }}>{e.lastValue}</div></div>
                    : <span className="badge gray">暂无关联数据</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!events.length && (
        <div className="alert-box info">未来 30 天暂无规则内的发布事件（或全部已过），请稍后再看。</div>
      )}

      <div className="card mt16">
        <h3>发布规则总表（自维护）</h3>
        <table className="tbl">
          <thead><tr><th>数据</th><th>地区</th><th>频率</th><th>发布时间规则（北京时间）</th></tr></thead>
          <tbody>
            {CALENDAR_RULES.map((r) => (
              <tr key={r.id}>
                <td className="bold small">{r.name}</td>
                <td><span className="badge blue">{r.region}</span></td>
                <td className="small">{r.freq === 'weekly' ? '每周' : r.freq === 'quarterly' ? '每季' : '每月'}</td>
                <td className="small muted">{r.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="alert-box gray mt16 small">
          💡 使用建议：<b>数据发布前</b>检查你的仓位假设是否依赖该数据；<b>发布后</b>到「指标库」确认信号变化，再对照「三档协议」决定是否倾斜。
          数据日历的价值是让你<b>在拐点信息落地的那一刻在场</b>，而不是事后听新闻。
        </div>
      </div>
    </div>
  );
}
