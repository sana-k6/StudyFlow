import { AnalyticsSummary } from '@studyflow/shared/types';
import { BookOpen } from 'lucide-react';

interface ModuleHoursChartProps {
  data: AnalyticsSummary['hours_by_module'];
  totalMins: number;
}

export default function ModuleHoursChart({ data, totalMins }: ModuleHoursChartProps) {
  if (data.length === 0 || totalMins === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <BookOpen className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">No study hours recorded yet</h4>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Log study sessions or complete scheduled blocks to visualize your module balance.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Study Time by Module</h3>
          <p className="text-xs text-slate-500">Distribution of logged focus hours</p>
        </div>
        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
          {(totalMins / 60).toFixed(1)} hrs total
        </span>
      </div>

      {/* Multi-Segment Stacked Bar */}
      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
        {data.map((mod) => {
          const percent = Math.round((mod.duration_mins / totalMins) * 100);
          if (percent === 0) return null;
          return (
            <div
              key={mod.module_id}
              className="h-full transition-all duration-300 hover:opacity-90"
              style={{
                width: `${percent}%`,
                backgroundColor: mod.color_hex || '#3B82F6',
              }}
              title={`${mod.module_code}: ${(mod.duration_mins / 60).toFixed(1)} hrs (${percent}%)`}
            />
          );
        })}
      </div>

      {/* Module Legend & Breakdown */}
      <div className="space-y-2.5 pt-2">
        {data.map((mod) => {
          const percent = totalMins > 0 ? Math.round((mod.duration_mins / totalMins) * 100) : 0;
          return (
            <div key={mod.module_id} className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: mod.color_hex || '#3B82F6' }}
                />
                <span className="font-bold text-slate-800 truncate">{mod.module_code}</span>
                <span className="text-slate-500 truncate hidden sm:inline">{mod.module_name}</span>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0 font-medium">
                <span className="text-slate-900 font-bold">{(mod.duration_mins / 60).toFixed(1)} hrs</span>
                <span className="text-slate-400 w-10 text-right">{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
