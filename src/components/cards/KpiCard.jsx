export default function KpiCard({ title, value, helper, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-dinkes-50 text-dinkes-700 ring-dinkes-100",
    gold: "bg-govgold-50 text-govgold-700 ring-govgold-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200"
  };

  return (
    <article className="surface group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-dinkes-700 via-teal-500 to-cyan-400 opacity-80" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <strong className="mt-2 block text-3xl font-bold text-slate-900">{value}</strong>
          {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
        </div>
        {Icon ? (
          <span className={`rounded-2xl p-3 ring-1 transition group-hover:scale-105 ${tones[tone]}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </article>
  );
}
